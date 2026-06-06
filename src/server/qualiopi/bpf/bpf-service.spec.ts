/**
 * Tests — bpf/service.ts (T10 — AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/documents/organisme.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn() },
    trainer: { count: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA SAS",
    nda: "11380490538",
    qualiopi: "CERT-2026-001",
    siret: "12345678900010",
    adresseSiege: "1 rue de Rivoli, 75001 Paris",
    adresseExercice: "Le Bourg, 38840 Saint-Lattier",
    email: "contact@axion-ia.com",
    telephone: "04 76 00 00 00",
    site: "https://axion-ia.com",
  }),
}));

import { prisma } from "@/lib/prisma";
import { computeBpf, bpfToCsv, type BpfResult } from "./service";

const mockPrisma = prisma as unknown as {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeSession(overrides: {
  id?: string;
  dureeReelleHeures?: number | null;
  nbParticipantsReels?: number | null;
  montantHtCents?: number;
  financementType?: string | null;
  enrollments?: Array<{ traineeId: string }>;
}) {
  return {
    id: overrides.id ?? "session-uuid-1",
    // Utiliser "id" dans overrides comme indicateur — null doit rester null
    dureeReelleHeures: "dureeReelleHeures" in overrides ? overrides.dureeReelleHeures : 7,
    nbParticipantsReels: "nbParticipantsReels" in overrides ? overrides.nbParticipantsReels : 10,
    montantHtCents: overrides.montantHtCents ?? 500000,
    financementType: "financementType" in overrides ? overrides.financementType : "direct",
    enrollments: overrides.enrollments ?? [{ traineeId: "trainee-1" }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// computeBpf
// ─────────────────────────────────────────────────────────────────────────────

describe("computeBpf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);
    mockPrisma.trainer.count.mockResolvedValue(0);
  });

  it("retourne des zéros si aucune session réalisée", async () => {
    const result = await computeBpf(2026);

    expect(result.nbSessions).toBe(0);
    expect(result.nbStagiairesDistincts).toBe(0);
    expect(result.nbHeuresStagiaires).toBe(0);
    expect(result.caTotalHtCents).toBe(0);
  });

  it("retourne l'identité de l'organisme", async () => {
    const result = await computeBpf(2026);

    expect(result.organisme.raisonSociale).toBe("Axion-IA SAS");
    expect(result.organisme.nda).toBe("11380490538");
    expect(result.organisme.siret).toBe("12345678900010");
  });

  it("compte les sessions réalisées", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1" }),
      makeSession({ id: "s2" }),
    ]);

    const result = await computeBpf(2026);
    expect(result.nbSessions).toBe(2);
  });

  it("déduplique les stagiaires (DISTINCT traineeId)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({
        id: "s1",
        enrollments: [{ traineeId: "t1" }, { traineeId: "t2" }],
      }),
      makeSession({
        id: "s2",
        // t1 apparaît dans 2 sessions → ne compter qu'une fois
        enrollments: [{ traineeId: "t1" }, { traineeId: "t3" }],
      }),
    ]);

    const result = await computeBpf(2026);
    expect(result.nbStagiairesDistincts).toBe(3); // t1, t2, t3
  });

  it("calcule nbHeuresStagiaires = Σ (dureeReelleHeures × nbParticipantsReels)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", dureeReelleHeures: 7, nbParticipantsReels: 10 }), // 70
      makeSession({ id: "s2", dureeReelleHeures: 14, nbParticipantsReels: 5 }), // 70
    ]);

    const result = await computeBpf(2026);
    expect(result.nbHeuresStagiaires).toBe(140);
  });

  it("ignore les sessions sans dureeReelleHeures ou nbParticipantsReels", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", dureeReelleHeures: null, nbParticipantsReels: 10 }),
      makeSession({ id: "s2", dureeReelleHeures: 7, nbParticipantsReels: null }),
      makeSession({ id: "s3", dureeReelleHeures: 7, nbParticipantsReels: 5 }), // 35
    ]);

    const result = await computeBpf(2026);
    expect(result.nbHeuresStagiaires).toBe(35);
  });

  it("calcule le CA total HT", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", montantHtCents: 300000 }),
      makeSession({ id: "s2", montantHtCents: 200000 }),
    ]);

    const result = await computeBpf(2026);
    expect(result.caTotalHtCents).toBe(500000);
  });

  it("répartit le CA par financeur", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", montantHtCents: 100000, financementType: "opco" }),
      makeSession({ id: "s2", montantHtCents: 200000, financementType: "cpf" }),
      makeSession({ id: "s3", montantHtCents: 300000, financementType: "direct" }),
    ]);

    const result = await computeBpf(2026);
    expect(result.caParFinanceur.opco).toBe(100000);
    expect(result.caParFinanceur.cpf).toBe(200000);
    expect(result.caParFinanceur.direct).toBe(300000);
    expect(result.caParFinanceur.france_travail).toBe(0);
    expect(result.caParFinanceur.mixte).toBe(0);
  });

  it("traite financementType=null comme 'direct'", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", montantHtCents: 150000, financementType: null }),
    ]);

    const result = await computeBpf(2026);
    expect(result.caParFinanceur.direct).toBe(150000);
  });

  it("compte les formateurs internes et externes", async () => {
    mockPrisma.trainer.count
      .mockResolvedValueOnce(3) // salarie
      .mockResolvedValueOnce(2); // sous_traitant

    const result = await computeBpf(2026);
    expect(result.nbFormateursInternes).toBe(3);
    expect(result.nbFormateursExternes).toBe(2);
  });

  it("retourne valeurs vides en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await computeBpf(2026);
      expect(result.nbSessions).toBe(0);
      expect(result.nbStagiairesDistincts).toBe(0);
      expect(mockPrisma.trainingSession.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("retourne l'année dans le résultat", async () => {
    const result = await computeBpf(2025);
    expect(result.annee).toBe(2025);
  });

  it("inclut calculeAt (Date)", async () => {
    const result = await computeBpf(2026);
    expect(result.calculeAt).toBeInstanceOf(Date);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// bpfToCsv
// ─────────────────────────────────────────────────────────────────────────────

describe("bpfToCsv", () => {
  const bpfFixture: BpfResult = {
    annee: 2026,
    organisme: {
      raisonSociale: "Axion-IA SAS",
      nda: "11380490538",
      siret: "12345678900010",
    },
    nbSessions: 15,
    nbStagiairesDistincts: 87,
    nbHeuresStagiaires: 609,
    caTotalHtCents: 4500000,
    caParFinanceur: {
      opco: 1500000,
      cpf: 500000,
      france_travail: 300000,
      direct: 2200000,
      mixte: 0,
    },
    nbFormateursInternes: 3,
    nbFormateursExternes: 2,
    calculeAt: new Date("2026-06-06T10:00:00.000Z"),
  };

  it("contient les en-têtes CSV en français", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(csv).toContain("Bilan Pédagogique et Financier");
    expect(csv).toContain("Organisme");
    expect(csv).toContain("NDA");
    expect(csv).toContain("SIRET");
    expect(csv).toContain("Indicateur");
    expect(csv).toContain("Financeur");
    expect(csv).toContain("Formateurs");
  });

  it("utilise `;` comme séparateur", () => {
    const csv = bpfToCsv(bpfFixture);
    const lignes = csv.split("\n");
    // Toutes les lignes avec données doivent contenir au moins un ;
    const lignesData = lignes.filter((l) => l.includes(";"));
    expect(lignesData.length).toBeGreaterThan(5);
  });

  it("contient les valeurs de l'organisme", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(csv).toContain("Axion-IA SAS");
    expect(csv).toContain("11380490538");
    expect(csv).toContain("12345678900010");
  });

  it("contient les indicateurs numériques", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(csv).toContain("15"); // nbSessions
    expect(csv).toContain("87"); // nbStagiairesDistincts
    expect(csv).toContain("609"); // nbHeuresStagiaires
  });

  it("convertit les centimes en euros (2 décimales)", () => {
    const csv = bpfToCsv(bpfFixture);
    // caTotalHtCents = 4_500_000 → 45000.00
    expect(csv).toContain("45000.00");
    // opco = 1_500_000 → 15000.00
    expect(csv).toContain("15000.00");
  });

  it("contient le nombre de formateurs", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(csv).toContain("3"); // internes
    expect(csv).toContain("2"); // externes
  });

  it("inclut OPCO, CPF, France Travail, direct, mixte", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(csv).toContain("OPCO");
    expect(csv).toContain("CPF");
    expect(csv).toContain("France Travail");
    expect(csv).toContain("direct");
    expect(csv).toContain("Mixte");
  });

  it("est une chaîne non vide", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(typeof csv).toBe("string");
    expect(csv.length).toBeGreaterThan(0);
  });
});
