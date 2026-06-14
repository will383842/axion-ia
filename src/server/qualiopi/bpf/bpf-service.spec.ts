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
    bpfDepense: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    coachingContract: { findMany: vi.fn() },
    coachingSession: { findMany: vi.fn() },
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
import { computeBpf, bpfToCsv, listDepenses, ajouterDepense, type BpfResult } from "./service";

const mockPrisma = prisma as unknown as {
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  trainer: { count: ReturnType<typeof vi.fn> };
  bpfDepense: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  coachingContract: { findMany: ReturnType<typeof vi.fn> };
  coachingSession: { findMany: ReturnType<typeof vi.fn> };
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

function makeContract(overrides: { montantHtCents?: number; financementType?: string | null }) {
  return {
    montantHtCents: overrides.montantHtCents ?? 139000,
    financementType: "financementType" in overrides ? overrides.financementType : "direct",
  };
}

function makeCoachingSession(dureesMinutes: Array<number | null>) {
  return {
    comptesRendus: dureesMinutes.map((dureeMinutes) => ({ dureeMinutes })),
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
    mockPrisma.bpfDepense.findMany.mockResolvedValue([]);
    mockPrisma.coachingContract.findMany.mockResolvedValue([]);
    mockPrisma.coachingSession.findMany.mockResolvedValue([]);
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

  it("inclut depenses avec total = 0 quand aucune dépense", async () => {
    const result = await computeBpf(2026);
    expect(result.depenses.totalHtCents).toBe(0);
    expect(result.depenses.items).toHaveLength(0);
    expect(result.depenses.parCategorie).toEqual({});
  });

  it("inclut depenses avec total et parCategorie agrégés", async () => {
    mockPrisma.bpfDepense.findMany.mockResolvedValue([
      {
        id: "dep-1",
        annee: 2026,
        categorie: "Locations de salles",
        libelle: "Salle A",
        montantHtCents: 35000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "dep-2",
        annee: 2026,
        categorie: "Matériel pédagogique",
        libelle: "Tablettes",
        montantHtCents: 15000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "dep-3",
        annee: 2026,
        categorie: "Locations de salles",
        libelle: "Salle B",
        montantHtCents: 20000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await computeBpf(2026);
    expect(result.depenses.totalHtCents).toBe(70000);
    expect(result.depenses.parCategorie["Locations de salles"]).toBe(55000);
    expect(result.depenses.parCategorie["Matériel pédagogique"]).toBe(15000);
    expect(result.depenses.items).toHaveLength(3);
  });

  // ── Coaching AFEST 1-to-1 (C1) ─────────────────────────────────────────────

  it("agrège le CA des CoachingContract dans le CA total", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", montantHtCents: 500000 }),
    ]);
    mockPrisma.coachingContract.findMany.mockResolvedValue([
      makeContract({ montantHtCents: 139000 }),
      makeContract({ montantHtCents: 99000 }),
    ]);

    const result = await computeBpf(2026);
    // 500000 (session) + 139000 + 99000 (coaching) = 738000
    expect(result.caTotalHtCents).toBe(738000);
  });

  it("ventile le CA coaching par financeur (en plus des sessions)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", montantHtCents: 200000, financementType: "opco" }),
    ]);
    mockPrisma.coachingContract.findMany.mockResolvedValue([
      makeContract({ montantHtCents: 139000, financementType: "opco" }),
      makeContract({ montantHtCents: 99000, financementType: "cpf" }),
      makeContract({ montantHtCents: 50000, financementType: "france_travail" }),
      makeContract({ montantHtCents: 30000, financementType: null }), // → direct
    ]);

    const result = await computeBpf(2026);
    expect(result.caParFinanceur.opco).toBe(200000 + 139000); // session + coaching
    expect(result.caParFinanceur.cpf).toBe(99000);
    expect(result.caParFinanceur.france_travail).toBe(50000);
    expect(result.caParFinanceur.direct).toBe(30000);
    expect(result.caParFinanceur.mixte).toBe(0);
  });

  it("ajoute les heures coaching = Σ CompteRenduSeance.dureeMinutes / 60 SANS multiplier par participants", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({ id: "s1", dureeReelleHeures: 7, nbParticipantsReels: 10 }), // 70 h collectif
    ]);
    mockPrisma.coachingSession.findMany.mockResolvedValue([
      // parcours 1 : 90 + 120 + 90 = 300 min → 5 h (1-to-1, pas ×participants)
      makeCoachingSession([90, 120, 90]),
      // parcours 2 : 60 + 60 = 120 min → 2 h
      makeCoachingSession([60, 60]),
    ]);

    const result = await computeBpf(2026);
    // 70 (collectif) + 5 + 2 (coaching 1-to-1) = 77
    expect(result.nbHeuresStagiaires).toBe(77);
  });

  it("ignore les comptes-rendus sans dureeMinutes pour les heures coaching", async () => {
    mockPrisma.coachingSession.findMany.mockResolvedValue([
      makeCoachingSession([120, null, 60]), // 180 min → 3 h
    ]);

    const result = await computeBpf(2026);
    expect(result.nbHeuresStagiaires).toBe(3);
  });

  it("gère un mix CoachingContract + TrainingSession (CA par financeur + heures coaching)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([
      makeSession({
        id: "s1",
        montantHtCents: 300000,
        financementType: "opco",
        dureeReelleHeures: 14,
        nbParticipantsReels: 8, // 112 h collectif
        enrollments: [{ traineeId: "t1" }, { traineeId: "t2" }],
      }),
    ]);
    mockPrisma.coachingContract.findMany.mockResolvedValue([
      makeContract({ montantHtCents: 139000, financementType: "opco" }),
      makeContract({ montantHtCents: 99000, financementType: "direct" }),
    ]);
    mockPrisma.coachingSession.findMany.mockResolvedValue([
      makeCoachingSession([90, 90, 90, 90]), // 360 min → 6 h
    ]);

    const result = await computeBpf(2026);
    // CA : 300000 + 139000 + 99000 = 538000
    expect(result.caTotalHtCents).toBe(538000);
    expect(result.caParFinanceur.opco).toBe(300000 + 139000);
    expect(result.caParFinanceur.direct).toBe(99000);
    // Heures : 112 (collectif) + 6 (coaching) = 118
    expect(result.nbHeuresStagiaires).toBe(118);
    // Rétrocompat : nbSessions inchangé (compte les TrainingSession uniquement)
    expect(result.nbSessions).toBe(1);
  });

  it("ne charge pas le coaching en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await computeBpf(2026);
      expect(result.caTotalHtCents).toBe(0);
      expect(result.nbHeuresStagiaires).toBe(0);
      expect(mockPrisma.coachingContract.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.coachingSession.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
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
    nbHeuresStagiairesCollectif: 549,
    nbHeuresStagiairesCoaching: 60,
    nbCoachingParcours: 4,
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
    depenses: { totalHtCents: 0, parCategorie: {}, items: [] },
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

  it("n'inclut pas de section Dépenses BPF si items vide", () => {
    const csv = bpfToCsv(bpfFixture);
    expect(csv).not.toContain("Dépenses BPF");
  });

  it("inclut la section Dépenses BPF si items non vide", () => {
    const withDepenses: BpfResult = {
      ...bpfFixture,
      depenses: {
        totalHtCents: 50000,
        parCategorie: { "Locations de salles": 35000, "Matériel pédagogique": 15000 },
        items: [
          {
            id: "dep-1",
            annee: 2026,
            categorie: "Locations de salles",
            libelle: "Salle Lyon Part-Dieu",
            montantHtCents: 35000,
            createdAt: new Date(),
          },
          {
            id: "dep-2",
            annee: 2026,
            categorie: "Matériel pédagogique",
            libelle: "Tablettes stagiaires",
            montantHtCents: 15000,
            createdAt: new Date(),
          },
        ],
      },
    };
    const csv = bpfToCsv(withDepenses);
    expect(csv).toContain("Dépenses BPF");
    expect(csv).toContain("Total dépenses");
    expect(csv).toContain("500.00"); // total 50000 centimes
    expect(csv).toContain("Locations de salles");
    expect(csv).toContain("Salle Lyon Part-Dieu");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listDepenses
// ─────────────────────────────────────────────────────────────────────────────

describe("listDepenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.bpfDepense.findMany.mockResolvedValue([]);
  });

  it("retourne vide si aucune dépense", async () => {
    const result = await listDepenses(2026);
    expect(result.totalHtCents).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.parCategorie).toEqual({});
  });

  it("agrège par catégorie correctement", async () => {
    mockPrisma.bpfDepense.findMany.mockResolvedValue([
      {
        id: "d1",
        annee: 2026,
        categorie: "Cat A",
        libelle: "Libellé 1",
        montantHtCents: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "d2",
        annee: 2026,
        categorie: "Cat A",
        libelle: "Libellé 2",
        montantHtCents: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "d3",
        annee: 2026,
        categorie: "Cat B",
        libelle: "Libellé 3",
        montantHtCents: 8000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await listDepenses(2026);
    expect(result.totalHtCents).toBe(23000);
    expect(result.parCategorie["Cat A"]).toBe(15000);
    expect(result.parCategorie["Cat B"]).toBe(8000);
    expect(result.items).toHaveLength(3);
  });

  it("retourne vide en mode stub.invalid", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await listDepenses(2026);
      expect(result.totalHtCents).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(mockPrisma.bpfDepense.findMany).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ajouterDepense
// ─────────────────────────────────────────────────────────────────────────────

describe("ajouterDepense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée une dépense et retourne un BpfDepenseItem", async () => {
    const now = new Date();
    mockPrisma.bpfDepense.create.mockResolvedValue({
      id: "new-id",
      annee: 2026,
      categorie: "Matériel pédagogique",
      libelle: "Tablettes",
      montantHtCents: 20000,
      createdAt: now,
      updatedAt: now,
    });

    const result = await ajouterDepense({
      annee: 2026,
      categorie: "Matériel pédagogique",
      libelle: "Tablettes",
      montantHtCents: 20000,
    });

    expect(result.id).toBe("new-id");
    expect(result.montantHtCents).toBe(20000);
    expect(result.categorie).toBe("Matériel pédagogique");
    expect(mockPrisma.bpfDepense.create).toHaveBeenCalledOnce();
  });

  it("retourne un stub en mode stub.invalid sans appel DB", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await ajouterDepense({
        annee: 2026,
        categorie: "Test",
        libelle: "Test",
        montantHtCents: 100,
      });
      expect(result.id).toBe("stub-id");
      expect(mockPrisma.bpfDepense.create).not.toHaveBeenCalled();
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });
});
