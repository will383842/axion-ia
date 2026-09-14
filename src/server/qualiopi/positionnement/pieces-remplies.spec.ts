/**
 * Pièces « positionnement rempli » du dossier d'audit — constat C2-03.
 *
 * Deux choses à garder : QUELS questionnaires deviennent une pièce (répondus,
 * de type positionnement, sur une session qui a eu lieu), et que chaque pièce
 * porte le nom du stagiaire, ses réponses et l'instant de la réponse.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { count: vi.fn(), findMany: vi.fn() },
    trainee: { findMany: vi.fn() },
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
import {
  compterPositionnementsRemplis,
  produirePiecesPositionnementRempli,
  wherePositionnementRempli,
} from "./pieces-remplies";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";

const mockPrisma = prisma as unknown as {
  questionnaire: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  trainee: { findMany: ReturnType<typeof vi.fn> };
};
const mockRender = renderPdfToBuffer as ReturnType<typeof vi.fn>;

const LIGNE = {
  id: "1a2b3c4d-0000-0000-0000-000000000000",
  reponduAt: new Date("2026-09-04T21:12:00.000Z"),
  reponses: { attentes: "Gagner du temps", besoinAdaptation: false },
  enrollment: {
    trainee: { id: "t-1", nom: "Martin", prenom: "Camille-Élise" },
    session: {
      titreSession: "IA générative",
      dateDebut: new Date("2026-09-05T07:00:00.000Z"),
    },
  },
};

type DonneesPiece = {
  nomStagiaire: string;
  reponduLe: string;
  chronologie: string;
  tireeLe: string;
  reponduAvantDebut: boolean;
  precisionSurFicheStagiaire: boolean;
  positionnement: Record<string, unknown>;
};

function donneesRendues(appel = 0): DonneesPiece {
  return (mockRender.mock.calls[appel]![0] as { props: { data: DonneesPiece } }).props.data;
}

describe("pièces positionnement rempli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.count.mockResolvedValue(0);
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);
    mockPrisma.trainee.findMany.mockResolvedValue([]);
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

  // ── Relectures de la PR 1090 : formes réelles ────────────────────────────

  it("le compte est fait EN BASE, sans charger les réponses (ni les anciens détails en clair)", async () => {
    mockPrisma.questionnaire.count.mockImplementation((args: { where: Record<string, unknown> }) =>
      Promise.resolve(args.where["reponses"] !== undefined ? 2 : 3),
    );

    expect(await compterPositionnementsRemplis()).toEqual({ parStagiaires: 1, parOrganisme: 2 });

    expect(mockPrisma.questionnaire.findMany).not.toHaveBeenCalled();
    const filtres = mockPrisma.questionnaire.count.mock.calls.map(
      (c: unknown[]) => (c[0] as { where: Record<string, unknown> }).where,
    );
    // Un compte TOTAL et un compte des saisies de l'organisme — jamais une
    // exclusion : une réponse sans la clé `saisie_admin` (le cas de TOUTES les
    // réponses du portail) reste dans le total, donc comptée côté stagiaires,
    // exactement comme `estSaisieOrganisme` la lit à l'écran.
    expect(filtres).toContainEqual(wherePositionnementRempli());
    expect(filtres).toContainEqual({
      ...wherePositionnementRempli(),
      reponses: { path: ["saisie_admin"], equals: true },
    });
    expect(JSON.stringify(filtres)).not.toMatch(/"not"\s*:\s*\{\s*"path"|NOT/);
  });

  it("rend une pièce nominative, datée, nommée par session et stagiaire", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([LIGNE]);

    const { pieces, echecs } = await produirePiecesPositionnementRempli();

    expect(echecs).toEqual([]);
    expect(pieces.map((p) => p.chemin)).toEqual([
      "positionnements/2026-09-05_martin-camille-elise_1a2b3c4d.pdf",
    ]);
    const data = donneesRendues();
    expect(data.nomStagiaire).toBe("Camille-Élise Martin");
    // Heure de Paris : c'est celle que l'auditrice compare au début de session.
    expect(data.reponduLe).toBe("4 septembre 2026 à 23:12");
    expect(data.positionnement).toMatchObject({
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
      const data = donneesRendues();
      expect(data.chronologie).toBe("avant le début de la session");
      expect(data.reponduAvantDebut).toBe(true);
      // Instant du tirage, jamais une date recopiée de la réponse ou de la session.
      expect(data.tireeLe).toBe("14 septembre 2026 à 14:30");
    } finally {
      vi.useRealTimers();
    }
  });

  it("une réponse arrivée APRÈS le début le porte sur la pièce", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, reponduAt: new Date("2026-09-05T08:00:00.000Z") },
    ]);
    await produirePiecesPositionnementRempli();
    expect(donneesRendues().reponduAvantDebut).toBe(false);
    expect(donneesRendues().chronologie).toBe("après le début de la session");
  });

  it("une saisie par l'organisme ne porte pas de réponse au besoin d'adaptation", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, reponses: { saisie_admin: true, besoinAdaptation: false } },
    ]);
    await produirePiecesPositionnementRempli();
    expect(donneesRendues().positionnement).toMatchObject({
      besoinAdaptation: null,
      saisieAdmin: true,
    });
  });

  it("🔴 besoin coché SANS précision, fiche portant un détail venu d'ailleurs : la pièce n'attribue AUCUNE précision au questionnaire", async () => {
    // La colonne chiffrée a été écrite par la déclaration de handicap du
    // portail, par la console, ou lors d'une session antérieure.
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, reponses: { besoinAdaptation: true, attentes: "Gagner du temps" } },
    ]);
    mockPrisma.trainee.findMany.mockResolvedValue([{ id: "t-1" }]);

    await produirePiecesPositionnementRempli();

    // La présence se lit par un filtre : la colonne chiffrée n'est pas chargée.
    const requete = mockPrisma.trainee.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(requete.where["handicapDetailsChiffre"]).toEqual({ not: null });
    expect(requete.select).toEqual({ id: true });

    const data = donneesRendues();
    expect(data.positionnement["precisionDansLaReponse"]).toBe(false);
    // La fiche est signalée À PART, sans être rattachée au questionnaire.
    expect(data.precisionSurFicheStagiaire).toBe(true);
  });

  it("détail ancien EN CLAIR dans les réponses : la réponse l'atteste, son contenu ne passe JAMAIS", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      {
        ...LIGNE,
        reponses: { besoinAdaptation: true, detailAdaptation: "Salle accessible en fauteuil" },
      },
    ]);

    await produirePiecesPositionnementRempli();

    const data = donneesRendues();
    expect(data.positionnement["precisionDansLaReponse"]).toBe(true);
    expect(data.precisionSurFicheStagiaire).toBe(false);
    expect(JSON.stringify(data)).not.toContain("fauteuil");
  });

  it("la pièce d'une saisie de l'organisme est nommée comme telle", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, reponses: { commentaire: "Appel téléphonique", saisie_admin: true } },
    ]);

    const { pieces } = await produirePiecesPositionnementRempli();

    expect(pieces.map((p) => p.chemin)).toEqual([
      "positionnements/2026-09-05_martin-camille-elise_1a2b3c4d_saisie-organisme.pdf",
    ]);
    expect(pieces[0]!.saisieOrganisme).toBe(true);
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
        saisieOrganisme: false,
      },
    ]);
  });
});
