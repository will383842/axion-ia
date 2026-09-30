/**
 * Pièces « évaluation finale RÉALISÉE » du dossier d'audit — constat du ZIP du
 * 2026-09-30 (indicateur 11 prouvé par la seule grille, sans résultat).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    evaluationAcquis: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({ raisonSociale: "Axion-IA SAS" })),
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: vi.fn(async () => ({
    buffer: Buffer.from("%PDF-1.4"),
    hashSha256: "0",
    sizeBytes: 8,
  })),
}));

import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { produirePiecesEvaluationRealisee, whereEvaluationRealisee } from "./pieces-realisees";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";

const mockPrisma = prisma as unknown as {
  evaluationAcquis: { findMany: ReturnType<typeof vi.fn> };
};
const mockRender = renderPdfToBuffer as ReturnType<typeof vi.fn>;

const LIGNE = {
  id: "9a8b7c6d-0000-0000-0000-000000000000",
  dateEvaluation: new Date("2026-09-12T22:30:00.000Z"),
  scoreObtenu: 8,
  scoreMax: 9,
  scorePct: 89,
  niveauGlobal: "acquis",
  reussite: true,
  competences: [
    { libelle: "Rédiger un prompt", note: 3, observations: "Autonome" },
    { libelle: "Vérifier une sortie", note: 2 },
    { libelle: "", note: 3 },
    { libelle: "Non notée" },
  ],
  recommandations: "Poursuivre sur les agents",
  enrollment: {
    trainee: { nom: "Martin", prenom: "Camille" },
    session: {
      titreSession: "IA générative",
      dateDebut: new Date("2026-09-11T07:00:00.000Z"),
    },
  },
};

type Donnees = {
  nomStagiaire: string;
  evalueeLe: string;
  scorePct: number;
  niveauGlobal: string;
  reussite: boolean;
  competences: { libelle: string; note?: number; observations?: string }[];
  recommandations: string | null;
};

function donneesRendues(appel = 0): Donnees {
  return (mockRender.mock.calls[appel]![0] as { props: { data: Donnees } }).props.data;
}

describe("pièces évaluation finale réalisée (ind. 11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([]);
  });

  it("ne retient que les évaluations FINALES d'une inscription sur une session tenue", () => {
    expect(whereEvaluationRealisee()).toEqual({
      type: "finale",
      enrollment: { session: { statut: { notIn: STATUTS_SESSION_SANS_PREUVE } } },
    });
  });

  it("rend une pièce nominative portant le résultat ENREGISTRÉ, sous evaluations/", async () => {
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([LIGNE]);
    const { pieces, echecs } = await produirePiecesEvaluationRealisee();
    expect(mockPrisma.evaluationAcquis.findMany.mock.calls[0]![0].where).toEqual(
      whereEvaluationRealisee(),
    );
    expect(echecs).toEqual([]);
    expect(pieces.map((p) => p.chemin)).toEqual([
      "evaluations/2026-09-11_martin-camille_9a8b7c6d.pdf",
    ]);
    const d = donneesRendues();
    expect(d.nomStagiaire).toBe("Camille Martin");
    // 22 h 30 UTC le 12 = le 13 à Paris.
    expect(d.evalueeLe).toContain("13 septembre 2026");
    expect(d.scorePct).toBe(89);
    expect(d.niveauGlobal).toBe("acquis");
    expect(d.reussite).toBe(true);
    expect(d.competences).toEqual([
      { libelle: "Rédiger un prompt", note: 3, observations: "Autonome" },
      { libelle: "Vérifier une sortie", note: 2 },
      { libelle: "Non notée" },
    ]);
    expect(d.recommandations).toBe("Poursuivre sur les agents");
  });

  it("droit à l'effacement : seule la fiche anonymisée est lue (nom, prénom)", async () => {
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([
      {
        ...LIGNE,
        enrollment: { ...LIGNE.enrollment, trainee: { nom: "[supprime]", prenom: "[supprime]" } },
      },
    ]);
    const { pieces } = await produirePiecesEvaluationRealisee();
    expect(pieces[0]!.chemin).not.toMatch(/martin|camille/i);
    const select = mockPrisma.evaluationAcquis.findMany.mock.calls[0]![0].select;
    expect(select.enrollment.select.trainee).toEqual({ select: { nom: true, prenom: true } });
  });

  it("un rendu en échec est RAPPORTÉ, pas avalé", async () => {
    mockPrisma.evaluationAcquis.findMany.mockResolvedValue([LIGNE]);
    mockRender.mockRejectedValueOnce(new Error("police absente"));
    const { pieces, echecs } = await produirePiecesEvaluationRealisee();
    expect(pieces).toEqual([]);
    expect(echecs).toEqual([
      { chemin: "evaluations/2026-09-11_martin-camille_9a8b7c6d.pdf", motif: "police absente" },
    ]);
  });
});
