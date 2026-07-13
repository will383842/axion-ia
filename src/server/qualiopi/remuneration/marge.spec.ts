/**
 * Tests — remuneration/marge.ts (Lot 6.3, cockpit financier).
 *
 * Stratégie : mock @/lib/prisma. Vérifie getMargeParSession (marge = CA − coût,
 * coutCalcule), getMargeParFormation (agrégation), getHeuresParFormateur,
 * getConsolidationMensuelle (bucket mensuel Paris), margeSessionsToCsv, stub-aware.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn() },
    trainerFeeLine: { groupBy: vi.fn() },
    sessionFormateur: { groupBy: vi.fn() },
    trainer: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getMargeParSession,
  getMargeParFormation,
  getHeuresParFormateur,
  getConsolidationMensuelle,
  margeSessionsToCsv,
} from "./marge";

type MockFn = ReturnType<typeof vi.fn>;
const mp = prisma as unknown as {
  trainingSession: { findMany: MockFn };
  trainerFeeLine: { groupBy: MockFn };
  sessionFormateur: { groupBy: MockFn };
  trainer: { findMany: MockFn };
};

const ORIG_DB = process.env["DATABASE_URL"];

const SESSIONS = [
  {
    id: "s1",
    numero: "SES-1",
    titreSession: "Prompt engineering",
    formationId: "f1",
    montantHtCents: 100_000,
    dateDebut: new Date("2026-03-10T09:00:00.000Z"),
    statut: "realisee",
    formation: { titre: "Formation A" },
  },
  {
    id: "s2",
    numero: "SES-2",
    titreSession: "RAG avancé",
    formationId: "f1",
    montantHtCents: 200_000,
    dateDebut: new Date("2026-06-20T09:00:00.000Z"),
    statut: "realisee",
    formation: { titre: "Formation A" },
  },
];

function setupMocks() {
  mp.trainingSession.findMany.mockResolvedValue(SESSIONS);
  mp.trainerFeeLine.groupBy.mockImplementation((arg: { by?: string[] }) => {
    if (arg.by?.[0] === "trainerId") {
      // getHeuresParFormateur : par (trainer, session, période). s1 rattaché à 2026:3.
      return Promise.resolve([
        {
          trainerId: "t1",
          sessionId: "s1",
          periodeYear: 2026,
          periodeMonth: 3,
          _sum: { montantHtCents: 40_000 },
        },
      ]);
    }
    // collecteSessionsMarge : par (session, période). Seule s1 (rattachée 2026:3)
    // a des lignes ; s2 → coût non calculé.
    return Promise.resolve([
      {
        sessionId: "s1",
        periodeYear: 2026,
        periodeMonth: 3,
        _sum: { montantHtCents: 40_000 },
        _count: { _all: 2 },
      },
    ]);
  });
  mp.sessionFormateur.groupBy.mockImplementation((arg: { by?: string[] }) => {
    if (arg.by?.[0] === "trainerId") {
      return Promise.resolve([
        { trainerId: "t1", _sum: { heuresAnimees: 21 }, _count: { _all: 2 } },
      ]);
    }
    return Promise.resolve([
      { sessionId: "s1", _sum: { heuresAnimees: 7 } },
      { sessionId: "s2", _sum: { heuresAnimees: 14 } },
    ]);
  });
  mp.trainer.findMany.mockResolvedValue([{ id: "t1", nom: "Doe", prenom: "Jane" }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://real:real@db:5432/app";
  setupMocks();
});

afterAll(() => {
  process.env["DATABASE_URL"] = ORIG_DB;
});

describe("getMargeParSession", () => {
  it("calcule marge = CA − coût, taux et coutCalcule par session", async () => {
    const rows = await getMargeParSession({ annee: 2026 });
    expect(rows).toHaveLength(2);

    const s1 = rows.find((r) => r.sessionId === "s1")!;
    expect(s1.caHtCents).toBe(100_000);
    expect(s1.coutFormateurCents).toBe(40_000);
    expect(s1.margeCents).toBe(60_000);
    expect(s1.tauxMargePct).toBe(60);
    expect(s1.heuresAnimees).toBe(7);
    expect(s1.coutCalcule).toBe(true);

    const s2 = rows.find((r) => r.sessionId === "s2")!;
    expect(s2.coutFormateurCents).toBe(0);
    expect(s2.margeCents).toBe(200_000);
    expect(s2.tauxMargePct).toBe(100);
    expect(s2.heuresAnimees).toBe(14);
    expect(s2.coutCalcule).toBe(false);
  });

  it("ignore une ligne de rémunération OBSOLÈTE (période ≠ rattachement courant)", async () => {
    // s1 est rattachée à 2026:3 ; une ligne résiduelle sur 2026:1 (report depuis
    // janvier) ne doit PAS être comptée → coût s1 reste 40 000, pas 90 000.
    mp.trainerFeeLine.groupBy.mockImplementation((arg: { by?: string[] }) => {
      if (arg.by?.[0] === "trainerId") return Promise.resolve([]);
      return Promise.resolve([
        {
          sessionId: "s1",
          periodeYear: 2026,
          periodeMonth: 3,
          _sum: { montantHtCents: 40_000 },
          _count: { _all: 2 },
        },
        {
          sessionId: "s1",
          periodeYear: 2026,
          periodeMonth: 1,
          _sum: { montantHtCents: 50_000 },
          _count: { _all: 1 },
        },
      ]);
    });
    const rows = await getMargeParSession({ annee: 2026 });
    const s1 = rows.find((r) => r.sessionId === "s1")!;
    expect(s1.coutFormateurCents).toBe(40_000);
    expect(s1.margeCents).toBe(60_000);
  });

  it("stub-aware → []", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await getMargeParSession({ annee: 2026 })).toEqual([]);
    expect(mp.trainingSession.findMany).not.toHaveBeenCalled();
  });
});

describe("getMargeParFormation", () => {
  it("agrège CA/coût/marge/heures par formation", async () => {
    const rows = await getMargeParFormation({ annee: 2026 });
    expect(rows).toHaveLength(1);
    const f = rows[0]!;
    expect(f.formationId).toBe("f1");
    expect(f.nbSessions).toBe(2);
    expect(f.caHtCents).toBe(300_000);
    expect(f.coutFormateurCents).toBe(40_000);
    expect(f.margeCents).toBe(260_000);
    expect(f.tauxMargePct).toBe(87); // round(260000/300000*100)
    expect(f.heuresAnimees).toBe(21);
  });
});

describe("getHeuresParFormateur", () => {
  it("agrège heures + coût par formateur avec nom résolu", async () => {
    const rows = await getHeuresParFormateur({ annee: 2026 });
    expect(rows).toHaveLength(1);
    const t = rows[0]!;
    expect(t.trainerId).toBe("t1");
    expect(t.trainerNom).toBe("Jane Doe");
    expect(t.heuresAnimees).toBe(21);
    expect(t.coutFormateurCents).toBe(40_000);
    expect(t.nbSessions).toBe(2);
  });
});

describe("getConsolidationMensuelle", () => {
  it("ventile CA/coût/marge par mois (Paris) + totaux", async () => {
    const conso = await getConsolidationMensuelle(2026);
    expect(conso.mois).toHaveLength(12);

    const mars = conso.mois[2]!; // index 2 = mois 3
    expect(mars.caHtCents).toBe(100_000);
    expect(mars.coutFormateurCents).toBe(40_000);
    expect(mars.margeCents).toBe(60_000);

    const juin = conso.mois[5]!;
    expect(juin.caHtCents).toBe(200_000);
    expect(juin.margeCents).toBe(200_000);

    expect(conso.totalCaHtCents).toBe(300_000);
    expect(conso.totalCoutFormateurCents).toBe(40_000);
    expect(conso.totalMargeCents).toBe(260_000);
  });

  it("stub-aware → 12 mois à 0", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const conso = await getConsolidationMensuelle(2026);
    expect(conso.mois).toHaveLength(12);
    expect(conso.totalMargeCents).toBe(0);
    expect(mp.trainingSession.findMany).not.toHaveBeenCalled();
  });
});

describe("margeSessionsToCsv", () => {
  it("sérialise l'en-tête, une ligne par session et le pied de période", async () => {
    const rows = await getMargeParSession({ annee: 2026 });
    const csv = margeSessionsToCsv(rows, 2026, { type: "annee" });
    expect(csv).toContain("CA HT (€)");
    expect(csv).toContain("SES-1");
    expect(csv).toContain('"Période"');
    expect(csv).toContain("année 2026");
    // Coût calculé oui/non présent
    expect(csv).toContain('"oui"');
    expect(csv).toContain('"non"');
  });
});
