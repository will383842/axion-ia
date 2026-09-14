/**
 * Pièces « positionnement rempli » du dossier d'audit — constat C2-03.
 *
 * Deux choses à garder : QUELS questionnaires deviennent une pièce (répondus,
 * de type positionnement, sur une session qui a eu lieu), et que chaque pièce
 * porte le nom du stagiaire, ses réponses et l'instant de la réponse.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { questionnaire: { count: vi.fn(), findMany: vi.fn() } },
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
import {
  compterPositionnementsRemplis,
  produirePiecesPositionnementRempli,
  wherePositionnementRempli,
} from "./pieces-remplies";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";

const mockPrisma = prisma as unknown as {
  questionnaire: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};
const mockRender = renderPdfToBuffer as ReturnType<typeof vi.fn>;

const LIGNE = {
  id: "1a2b3c4d-0000-0000-0000-000000000000",
  reponduAt: new Date("2026-09-04T21:12:00.000Z"),
  reponses: { attentes: "Gagner du temps", besoinAdaptation: false },
  enrollment: {
    trainee: { nom: "Martin", prenom: "Camille-Élise" },
    session: {
      titreSession: "IA générative",
      dateDebut: new Date("2026-09-05T07:00:00.000Z"),
    },
  },
};

describe("pièces positionnement rempli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.count.mockResolvedValue(0);
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);
  });

  it("ne retient que les positionnements RÉPONDUS sur une session tenue", () => {
    expect(wherePositionnementRempli()).toEqual({
      type: "positionnement",
      reponduAt: { not: null },
      enrollment: { session: { statut: { notIn: STATUTS_SESSION_SANS_PREUVE } } },
    });
  });

  it("le compte et la liste lisent le MÊME prédicat", async () => {
    await compterPositionnementsRemplis();
    await produirePiecesPositionnementRempli();
    expect(mockPrisma.questionnaire.count.mock.calls[0]![0].where).toEqual(
      wherePositionnementRempli(),
    );
    expect(mockPrisma.questionnaire.findMany.mock.calls[0]![0].where).toEqual(
      wherePositionnementRempli(),
    );
  });

  it("rend une pièce nominative, datée, nommée par session et stagiaire", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([LIGNE]);

    const { pieces, echecs } = await produirePiecesPositionnementRempli();

    expect(echecs).toEqual([]);
    expect(pieces.map((p) => p.chemin)).toEqual([
      "positionnements/2026-09-05_martin-camille-elise_1a2b3c4d.pdf",
    ]);
    const element = mockRender.mock.calls[0]![0] as {
      props: { data: { nomStagiaire: string; reponduLe: string; positionnement: unknown } };
    };
    expect(element.props.data.nomStagiaire).toBe("Camille-Élise Martin");
    // Heure de Paris : c'est celle que l'auditrice compare au début de session.
    expect(element.props.data.reponduLe).toBe("4 septembre 2026 à 23:12");
    expect(element.props.data.positionnement).toMatchObject({
      attentes: "Gagner du temps",
      besoinAdaptation: false,
    });
  });

  it("la pièce dit si la réponse précède le début, et porte sa date de tirage RÉELLE", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T12:30:00.000Z"));
    try {
      mockPrisma.questionnaire.findMany.mockResolvedValue([LIGNE]);
      await produirePiecesPositionnementRempli();
      const element = mockRender.mock.calls[0]![0] as {
        props: { data: { chronologie: string; tireeLe: string } };
      };
      expect(element.props.data.chronologie).toBe("avant le début de la session");
      // Instant du tirage, jamais une date recopiée de la réponse ou de la session.
      expect(element.props.data.tireeLe).toBe("14 septembre 2026 à 14:30");
    } finally {
      vi.useRealTimers();
    }
  });

  it("une saisie par l'organisme ne porte pas de réponse au besoin d'adaptation", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, reponses: { saisie_admin: true, besoinAdaptation: false } },
    ]);
    await produirePiecesPositionnementRempli();
    const element = mockRender.mock.calls[0]![0] as {
      props: { data: { positionnement: { besoinAdaptation: unknown; saisieAdmin: unknown } } };
    };
    expect(element.props.data.positionnement).toMatchObject({
      besoinAdaptation: null,
      saisieAdmin: true,
    });
  });

  it("un rendu en échec est RAPPORTÉ, pas avalé", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([LIGNE]);
    mockRender.mockRejectedValueOnce(new Error("police absente"));

    const { pieces, echecs } = await produirePiecesPositionnementRempli();

    expect(pieces).toEqual([]);
    expect(echecs).toEqual([
      {
        chemin: "positionnements/2026-09-05_martin-camille-elise_1a2b3c4d.pdf",
        motif: "police absente",
      },
    ]);
  });
});
