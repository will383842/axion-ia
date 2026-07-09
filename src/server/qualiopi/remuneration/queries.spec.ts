/**
 * Tests — queries.ts (lecture des relevés).
 *
 * L'enjeu est double : ces lectures tournent au build (Prisma stub → elles
 * doivent rendre du vide, pas exploser), et l'agrégat BPF est un chiffre
 * DÉCLARÉ à l'administration — il ne doit compter que des honoraires engagés.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStatementFindMany = vi.fn();
const mockFeeLineFindMany = vi.fn();
const mockStatementFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findMany: (...a: unknown[]) => mockStatementFindMany(...a),
      findUnique: (...a: unknown[]) => mockStatementFindUnique(...a),
    },
    trainerFeeLine: { findMany: (...a: unknown[]) => mockFeeLineFindMany(...a) },
  },
}));

import {
  getReleveDetail,
  honorairesSousTraitanceAnnee,
  listAnomaliesPeriode,
  listRelevesPeriode,
} from "./queries";

const JUIN = { year: 2026, month: 6 };

beforeEach(() => {
  vi.clearAllMocks();
  mockStatementFindMany.mockResolvedValue([]);
  mockFeeLineFindMany.mockResolvedValue([]);
  mockStatementFindUnique.mockResolvedValue(null);
});

describe("robustesse au stub de build", () => {
  it("listRelevesPeriode rend [] quand la base est absente", async () => {
    mockStatementFindMany.mockRejectedValue(new Error("no db"));
    await expect(listRelevesPeriode(JUIN)).resolves.toEqual([]);
  });

  it("getReleveDetail rend null quand la base est absente", async () => {
    mockStatementFindUnique.mockRejectedValue(new Error("no db"));
    await expect(getReleveDetail("x")).resolves.toBeNull();
  });

  it("listAnomaliesPeriode rend [] quand la base est absente", async () => {
    mockFeeLineFindMany.mockRejectedValue(new Error("no db"));
    await expect(listAnomaliesPeriode(JUIN)).resolves.toEqual([]);
  });

  it("honorairesSousTraitanceAnnee rend 0 quand la base est absente", async () => {
    mockFeeLineFindMany.mockRejectedValue(new Error("no db"));
    const r = await honorairesSousTraitanceAnnee(2026);
    expect(r).toEqual({ annee: 2026, totalHtCents: 0, parFormateur: [] });
  });
});

describe("honorairesSousTraitanceAnnee — ce que le BPF a le droit de compter", () => {
  it("ne compte QUE les honoraires de relevés engagés", async () => {
    await honorairesSousTraitanceAnnee(2026);
    const where = mockFeeLineFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;

    expect(where.periodeYear).toBe(2026);
    // Un salaire (`analytique`) est déclaré ailleurs : jamais ici.
    expect(where.nature).toBe("honoraire_du");
    // Un montant que personne n'a relu n'est pas une charge de l'exercice.
    expect(where.statement).toEqual({ statut: { in: ["valide", "facture_recue", "paye"] } });
  });

  it("agrège par formateur et trie du plus gros au plus petit", async () => {
    mockFeeLineFindMany.mockResolvedValue([
      { trainerId: "t1", montantHtCents: 50_000, trainer: { prenom: "Ana", nom: "Roux" } },
      { trainerId: "t2", montantHtCents: 90_000, trainer: { prenom: "Bo", nom: "Li" } },
      { trainerId: "t1", montantHtCents: 30_000, trainer: { prenom: "Ana", nom: "Roux" } },
    ]);

    const r = await honorairesSousTraitanceAnnee(2026);
    expect(r.totalHtCents).toBe(170_000);
    expect(r.parFormateur).toEqual([
      { trainerId: "t2", trainerNom: "Bo Li", totalHtCents: 90_000 },
      { trainerId: "t1", trainerNom: "Ana Roux", totalHtCents: 80_000 },
    ]);
  });
});

describe("getReleveDetail", () => {
  it("marque `rattacheeAuReleve` seulement pour les lignes du relevé", async () => {
    mockStatementFindUnique.mockResolvedValue({
      id: "st1",
      trainerId: "t1",
      periodeYear: 2026,
      periodeMonth: 6,
      statut: "brouillon",
      tvaRegime: "assujetti_20",
      totalHtCents: 90_000,
      tvaCents: 18_000,
      totalTtcCents: 108_000,
      numeroFacture: null,
      dateFacture: null,
      montantFactureTtcCents: null,
      payeAt: null,
      moyenPaiement: null,
      trainer: { prenom: "Ana", nom: "Roux" },
    });
    mockFeeLineFindMany.mockResolvedValue([
      {
        id: "l1",
        prestationType: "formation_collective",
        model: "taux_journalier",
        nature: "honoraire_du",
        statut: "calcule",
        heures: { toNumber: () => 7 },
        montantHtCents: 90_000,
        caBaseCents: 0,
        motif: null,
        statementId: "st1",
      },
      {
        id: "l2",
        prestationType: "formation_collective",
        model: "taux_journalier",
        nature: "honoraire_du",
        statut: "previsionnel",
        heures: null,
        montantHtCents: 45_000,
        caBaseCents: 0,
        motif: null,
        statementId: null,
      },
    ]);

    const r = await getReleveDetail("st1");
    expect(r?.trainerNom).toBe("Ana Roux");
    expect(r?.lignes[0]?.rattacheeAuReleve).toBe(true);
    expect(r?.lignes[0]?.heures).toBe(7); // Decimal → number
    // La prévisionnelle est MONTRÉE mais non facturée : le total reste lisible.
    expect(r?.lignes[1]?.rattacheeAuReleve).toBe(false);
    expect(r?.lignes[1]?.heures).toBeNull();
    expect(r?.totalHtCents).toBe(90_000);
  });
});
