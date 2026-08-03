/**
 * Tests — registres/revue-direction-service.ts (T12 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/indicateurs/service.
 * Vérifie : creerRevue (snapshot indicateurs), updateRevue, getRevue, listRevues, stub-aware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    revueDirection: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/qualiopi/indicateurs/service", () => ({
  getIndicateurs: vi.fn().mockResolvedValue({
    annee: 2026,
    tauxSatisfaction: { tauxPct: 90, nb: 20, fiable: true, libelle: "90 %" },
    tauxReussite: { tauxPct: 85, nb: 20, fiable: true, libelle: "85 %" },
    tauxCompletion: { tauxPct: 95, nb: 20, fiable: true, libelle: "95 %" },
    delaiAccesMoyen: { jours: 12, nb: 20, fiable: true },
    methodes: {
      satisfaction: "Calculé sur...",
      reussite: "Calculé sur...",
      completion: "Calculé sur...",
      delaiAcces: "Calculé sur...",
    },
    calculeAt: new Date("2026-06-06T10:00:00.000Z"),
  }),
}));

import { prisma } from "@/lib/prisma";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import {
  creerRevue,
  updateRevue,
  getRevue,
  listRevues,
  reporterConstatRevue,
} from "./revue-direction-service";

const mockPrisma = prisma as unknown as {
  revueDirection: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockGetIndicateurs = getIndicateurs as ReturnType<typeof vi.fn>;

// Valeur de référence (définie APRÈS hoisting des mocks).
const INDICATEURS_FIXTURE = {
  annee: 2026,
  tauxSatisfaction: { tauxPct: 90, nb: 20, fiable: true, libelle: "90 %" },
  tauxReussite: { tauxPct: 85, nb: 20, fiable: true, libelle: "85 %" },
  tauxCompletion: { tauxPct: 95, nb: 20, fiable: true, libelle: "95 %" },
  delaiAccesMoyen: { jours: 12, nb: 20, fiable: true },
  methodes: {
    satisfaction: "Calculé sur...",
    reussite: "Calculé sur...",
    completion: "Calculé sur...",
    delaiAcces: "Calculé sur...",
  },
  calculeAt: new Date("2026-06-06T10:00:00.000Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRevue(overrides: Record<string, unknown> = {}) {
  return {
    id: "revue-uuid-001",
    annee: 2026,
    dateRevue: new Date("2026-12-15T10:00:00.000Z"),
    participants: [],
    indicateursSnapshot: INDICATEURS_FIXTURE,
    decisions: [],
    planActions: [],
    statut: "brouillon",
    createdAt: new Date("2026-12-15T10:00:00.000Z"),
    updatedAt: new Date("2026-12-15T10:00:00.000Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// creerRevue
// ─────────────────────────────────────────────────────────────────────────────

describe("creerRevue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIndicateurs.mockResolvedValue(INDICATEURS_FIXTURE);
    mockPrisma.revueDirection.create.mockResolvedValue(makeRevue());
  });

  it("crée une revue avec snapshot indicateurs de l'année", async () => {
    const result = await creerRevue(2026, {
      dateRevue: new Date("2026-12-15T10:00:00.000Z"),
    });

    expect(mockGetIndicateurs).toHaveBeenCalledWith(2026);
    expect(mockPrisma.revueDirection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          annee: 2026,
          dateRevue: expect.any(Date),
          indicateursSnapshot: INDICATEURS_FIXTURE,
          statut: "brouillon",
        }),
      }),
    );
    expect(result.annee).toBe(2026);
  });

  it("transmet participants, decisions, planActions si fournis", async () => {
    const participants = [{ nom: "Williams Jullin", role: "Président" }];
    const decisions = [{ texte: "Réviser les modalités d'évaluation." }];
    const planActions = [{ action: "Mettre à jour les grilles.", echeance: "2027-01-31" }];

    await creerRevue(2026, {
      dateRevue: new Date("2026-12-15T10:00:00.000Z"),
      participants,
      decisions,
      planActions,
      statut: "validee",
    });

    expect(mockPrisma.revueDirection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participants,
          decisions,
          planActions,
          statut: "validee",
        }),
      }),
    );
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(creerRevue(2026, { dateRevue: new Date() })).rejects.toThrow("stub.invalid");
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateRevue
// ─────────────────────────────────────────────────────────────────────────────

describe("updateRevue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.revueDirection.update.mockResolvedValue(makeRevue({ statut: "validee" }));
  });

  it("met à jour les champs fournis uniquement", async () => {
    const result = await updateRevue("revue-uuid-001", { statut: "validee" });

    expect(mockPrisma.revueDirection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "revue-uuid-001" },
        data: expect.objectContaining({ statut: "validee" }),
      }),
    );
    expect(result.statut).toBe("validee");
  });

  it("ne transmet pas les champs undefined", async () => {
    await updateRevue("revue-uuid-001", { statut: "validee" });
    const callData = mockPrisma.revueDirection.update.mock.calls[0]![0].data;
    expect("dateRevue" in callData).toBe(false);
    expect("participants" in callData).toBe(false);
  });

  it("peut mettre à jour le snapshot indicateurs directement", async () => {
    const nouveauSnapshot = { annee: 2026, note: "nouveau snapshot" };
    await updateRevue("revue-uuid-001", { indicateursSnapshot: nouveauSnapshot });

    expect(mockPrisma.revueDirection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ indicateursSnapshot: nouveauSnapshot }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRevue
// ─────────────────────────────────────────────────────────────────────────────

describe("getRevue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.revueDirection.findUnique.mockResolvedValue(makeRevue());
  });

  it("retourne la revue d'une année", async () => {
    const result = await getRevue(2026);
    expect(result?.annee).toBe(2026);
    expect(mockPrisma.revueDirection.findUnique).toHaveBeenCalledWith({ where: { annee: 2026 } });
  });

  it("retourne null si aucune revue pour l'année", async () => {
    mockPrisma.revueDirection.findUnique.mockResolvedValue(null);
    const result = await getRevue(2025);
    expect(result).toBeNull();
  });

  it("retourne null en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await getRevue(2026);
      expect(result).toBeNull();
      expect(mockPrisma.revueDirection.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listRevues
// ─────────────────────────────────────────────────────────────────────────────

describe("listRevues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.revueDirection.findMany.mockResolvedValue([
      makeRevue({ annee: 2026 }),
      makeRevue({ annee: 2025, id: "revue-uuid-002" }),
    ]);
  });

  it("retourne toutes les revues triées par année décroissante", async () => {
    const result = await listRevues();
    expect(result).toHaveLength(2);
    expect(mockPrisma.revueDirection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { annee: "desc" } }),
    );
  });

  it("retourne [] en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listRevues();
      expect(result).toEqual([]);
      expect(mockPrisma.revueDirection.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reporterConstatRevue (LOT 4)
// ─────────────────────────────────────────────────────────────────────────────

describe("reporterConstatRevue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIndicateurs.mockResolvedValue(INDICATEURS_FIXTURE);
  });

  it("ajoute le constat au planActions d'une revue existante (creee=false)", async () => {
    mockPrisma.revueDirection.findUnique.mockResolvedValue({
      id: "revue-2026",
      annee: 2026,
      planActions: [{ action: "Action existante" }],
    });
    mockPrisma.revueDirection.update.mockResolvedValue({ id: "revue-2026" });

    const result = await reporterConstatRevue(2026, {
      texte: "Prévoir une pause supplémentaire l'après-midi.",
      source: "Verbatim satisfaction — session AXI-SES-2026-007",
    });

    expect(result).toEqual({ id: "revue-2026", annee: 2026, creee: false });
    expect(mockPrisma.revueDirection.create).not.toHaveBeenCalled();
    const arg = mockPrisma.revueDirection.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { planActions: Array<Record<string, unknown>> };
    };
    expect(arg.where.id).toBe("revue-2026");
    expect(arg.data.planActions).toHaveLength(2);
    expect(arg.data.planActions[1]).toMatchObject({
      action: "Prévoir une pause supplémentaire l'après-midi.",
      source: "Verbatim satisfaction — session AXI-SES-2026-007",
    });
    expect(typeof arg.data.planActions[1]?.["ajouteAt"]).toBe("string");
  });

  it("crée la revue en brouillon (avec snapshot indicateurs) si absente (creee=true)", async () => {
    mockPrisma.revueDirection.findUnique.mockResolvedValue(null);
    mockPrisma.revueDirection.create.mockResolvedValue({
      id: "revue-new",
      annee: 2026,
      planActions: [],
    });
    mockPrisma.revueDirection.update.mockResolvedValue({ id: "revue-new" });

    const result = await reporterConstatRevue(2026, { texte: "Constat", source: "Synthèse" });

    expect(result).toEqual({ id: "revue-new", annee: 2026, creee: true });
    // creerRevue appelé → snapshot indicateurs + statut brouillon
    expect(mockGetIndicateurs).toHaveBeenCalledWith(2026);
    const createArg = mockPrisma.revueDirection.create.mock.calls[0]?.[0] as {
      data: { statut: string };
    };
    expect(createArg.data.statut).toBe("brouillon");
    // Puis le constat est ajouté
    const updateArg = mockPrisma.revueDirection.update.mock.calls[0]?.[0] as {
      data: { planActions: unknown[] };
    };
    expect(updateArg.data.planActions).toHaveLength(1);
  });

  it("lève en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await expect(reporterConstatRevue(2026, { texte: "x", source: "y" })).rejects.toThrow(
        /stub\.invalid/,
      );
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
