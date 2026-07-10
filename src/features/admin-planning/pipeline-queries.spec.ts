// Tests — pipeline-queries.ts (lecture de l'entonnoir).
//
// Trois pièges verrouillés ici, tous invisibles depuis le moteur pur :
//   - `Submission` s'horodate avec `submittedAt`, pas `createdAt` ;
//   - les factures se filtrent sur `createdAt`, jamais sur `emiseAt` (un
//     brouillon n'a pas de date d'émission, et c'est lui qui laisse une session
//     « à facturer ») ;
//   - une facture ANTÉRIEURE à la fenêtre mais rattachée à une session DE la
//     fenêtre doit être lue, sinon la session ressort « à facturer » à tort.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubmission = vi.fn();
const mockDevis = vi.fn();
const mockSession = vi.fn();
const mockFacture = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (...a: unknown[]) => mockSubmission(...a) },
    devis: { findMany: (...a: unknown[]) => mockDevis(...a) },
    trainingSession: { findMany: (...a: unknown[]) => mockSession(...a) },
    factureFormation: { findMany: (...a: unknown[]) => mockFacture(...a) },
  },
}));

import { FENETRE_JOURS_DEFAUT, getPipeline } from "./pipeline-queries";

const MAINTENANT = new Date("2026-06-10T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockSubmission.mockResolvedValue([]);
  mockDevis.mockResolvedValue([]);
  mockSession.mockResolvedValue([]);
  mockFacture.mockResolvedValue([]);
});

const etage = (p: Awaited<ReturnType<typeof getPipeline>>, code: string) =>
  p.etages.find((e) => e.code === code);

describe("fenêtre glissante", () => {
  it("remonte 180 jours par défaut", async () => {
    await getPipeline(MAINTENANT);
    const where = mockDevis.mock.calls[0]?.[0]?.where as { createdAt: { gte: Date } };
    const attendu = new Date(MAINTENANT.getTime() - FENETRE_JOURS_DEFAUT * 86_400_000);
    expect(where.createdAt.gte.toISOString()).toBe(attendu.toISOString());
  });

  it("respecte une fenêtre personnalisée", async () => {
    await getPipeline(MAINTENANT, 30);
    const where = mockDevis.mock.calls[0]?.[0]?.where as { createdAt: { gte: Date } };
    expect(where.createdAt.gte.toISOString()).toBe("2026-05-11T12:00:00.000Z");
  });

  it("les sessions sont bornées sur `dateFin`, pas sur leur début", async () => {
    // Une formation commencée avant la fenêtre mais terminée dedans est bien
    // « réalisée » dans la période : elle doit apparaître.
    await getPipeline(MAINTENANT);
    const where = mockSession.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).toHaveProperty("dateFin");
    expect(where).not.toHaveProperty("dateDebut");
  });
});

describe("Submission — horodatage `submittedAt`", () => {
  it("filtre sur `submittedAt` et non sur `createdAt` (qui n'existe pas)", async () => {
    await getPipeline(MAINTENANT);
    const where = mockSubmission.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).toHaveProperty("submittedAt");
    expect(where).not.toHaveProperty("createdAt");
  });

  it("mappe `submittedAt` vers la notion de date de création du moteur", async () => {
    mockSubmission.mockResolvedValue([
      { status: "qualifying", submittedAt: new Date("2026-06-01T00:00:00Z") },
    ]);
    const p = await getPipeline(MAINTENANT);
    expect(etage(p, "demande")?.nb).toBe(1);
    expect(etage(p, "demande")?.ageMaxJours).toBe(9);
  });
});

describe("factures — les deux pièges", () => {
  it("filtre sur `createdAt`, JAMAIS sur `emiseAt`", async () => {
    // Un brouillon n'a pas de date d'émission : le filtrer dessus l'effacerait.
    await getPipeline(MAINTENANT);
    const where = mockFacture.mock.calls[0]?.[0]?.where as { OR: Record<string, unknown>[] };
    const cles = where.OR.flatMap((c) => Object.keys(c));
    expect(cles).toContain("createdAt");
    expect(cles).not.toContain("emiseAt");
  });

  it("RÉGRESSION : rattrape une facture ANTÉRIEURE à la fenêtre via sa session", async () => {
    mockSession.mockResolvedValue([
      {
        id: "s1",
        statut: "realisee",
        montantHtCents: 200_000,
        dateFin: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    await getPipeline(MAINTENANT);

    const where = mockFacture.mock.calls[0]?.[0]?.where as {
      OR: { sessionId?: { in: string[] } }[];
    };
    const parSession = where.OR.find((c) => c.sessionId !== undefined);
    expect(parSession?.sessionId?.in).toEqual(["s1"]);
  });

  it("sans session, le `OR` ne contient pas de clause `sessionId` vide", async () => {
    // `{ sessionId: { in: [] } }` ne matcherait rien et polluerait la requête.
    await getPipeline(MAINTENANT);
    const where = mockFacture.mock.calls[0]?.[0]?.where as { OR: Record<string, unknown>[] };
    expect(where.OR).toHaveLength(1);
    expect(where.OR[0]).toHaveProperty("createdAt");
  });

  it("une session facturée par une facture ancienne n'est PAS « à facturer »", async () => {
    mockSession.mockResolvedValue([
      {
        id: "s1",
        statut: "realisee",
        montantHtCents: 200_000,
        dateFin: new Date("2026-06-01T00:00:00Z"),
      },
    ]);
    mockFacture.mockResolvedValue([
      {
        sessionId: "s1",
        statut: "emise",
        montantHtCents: 200_000,
        emiseAt: new Date("2025-01-01T00:00:00Z"),
      },
    ]);
    const p = await getPipeline(MAINTENANT);
    expect(etage(p, "a_facturer")?.nb).toBe(0);
  });
});

describe("robustesse au stub de build", () => {
  it("une base absente rend un entonnoir vide, pas une exception", async () => {
    mockSubmission.mockRejectedValue(new Error("no db"));
    mockDevis.mockRejectedValue(new Error("no db"));
    mockSession.mockRejectedValue(new Error("no db"));
    mockFacture.mockRejectedValue(new Error("no db"));

    const p = await getPipeline(MAINTENANT);
    expect(p.etages.every((e) => e.nb === 0)).toBe(true);
    expect(p.fuites).toEqual([]);
    expect(p.tauxAcceptationDevisPct).toBeNull();
  });
});
