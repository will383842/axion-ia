/**
 * Tests — registres/incidents-service.ts (LOT 4).
 *
 * Stratégie : mock @/lib/prisma.
 * Vérifie : creerIncident (resoluAt si statut resolu), updateIncident
 * (resoluAt posé/effacé selon statut), supprimerIncident, getIncident,
 * listIncidents (filtres + include session), stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    incident: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  creerIncident,
  updateIncident,
  supprimerIncident,
  getIncident,
  listIncidents,
} from "./incidents-service";

type MockFn = ReturnType<typeof vi.fn>;

const mockPrisma = prisma as unknown as {
  incident: {
    create: MockFn;
    update: MockFn;
    delete: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
  };
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
// updateIncident
// ─────────────────────────────────────────────────────────────────────────────

describe("updateIncident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incident.update.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("statut → resolu : pose resoluAt", async () => {
    await updateIncident(INCIDENT_UUID, { statut: "resolu" });

    const arg = mockPrisma.incident.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where.id).toBe(INCIDENT_UUID);
    expect(arg.data["statut"]).toBe("resolu");
    expect(arg.data["resoluAt"]).toBeInstanceOf(Date);
  });

  it("statut → en_cours : remet resoluAt à null", async () => {
    await updateIncident(INCIDENT_UUID, { statut: "en_cours" });

    const arg = mockPrisma.incident.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data["statut"]).toBe("en_cours");
    expect(arg.data["resoluAt"]).toBeNull();
  });

  it("ne touche pas resoluAt si le statut n'est pas fourni", async () => {
    await updateIncident(INCIDENT_UUID, { actionCorrective: "Doubler la connexion" });

    const arg = mockPrisma.incident.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data["actionCorrective"]).toBe("Doubler la connexion");
    expect("resoluAt" in arg.data).toBe(false);
    expect("statut" in arg.data).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// supprimerIncident / getIncident
// ─────────────────────────────────────────────────────────────────────────────

describe("supprimerIncident / getIncident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incident.delete.mockResolvedValue({ id: INCIDENT_UUID });
    mockPrisma.incident.findUnique.mockResolvedValue({ id: INCIDENT_UUID });
  });

  it("supprimerIncident délègue à prisma.incident.delete", async () => {
    await supprimerIncident(INCIDENT_UUID);
    expect(mockPrisma.incident.delete).toHaveBeenCalledWith({ where: { id: INCIDENT_UUID } });
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
