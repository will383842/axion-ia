/**
 * Pièces « satisfaction RÉPONDUE » du dossier d'audit — constat du ZIP du
 * 2026-09-30 (indicateur 30 sans aucune preuve de recueil).
 *
 * Même modèle que les positionnements remplis : QUELS questionnaires deviennent
 * une pièce (à chaud / à froid, répondus, sur une session tenue), et chaque
 * pièce porte le nom du stagiaire, ses réponses et l'instant de la réponse.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { findMany: vi.fn() },
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
import { produirePiecesSatisfactionRemplie, whereSatisfactionRemplie } from "./pieces-remplies";
import { STATUTS_SESSION_SANS_PREUVE } from "@/server/qualiopi/conformite/piece-admissible";

const mockPrisma = prisma as unknown as {
  questionnaire: { findMany: ReturnType<typeof vi.fn> };
};
const mockRender = renderPdfToBuffer as ReturnType<typeof vi.fn>;

const LIGNE = {
  id: "5e6f7a8b-0000-0000-0000-000000000000",
  type: "satisfaction_chaud",
  // 22 h 40 UTC le 12 = 00 h 40 à Paris le 13.
  reponduAt: new Date("2026-09-12T22:40:00.000Z"),
  noteGlobale: 4,
  reponses: { commentaire: "Très concret" },
  enrollment: {
    trainee: { nom: "Martin", prenom: "Camille-Élise" },
    session: {
      titreSession: "IA générative",
      dateDebut: new Date("2026-09-11T07:00:00.000Z"),
      dateFin: new Date("2026-09-12T15:00:00.000Z"),
    },
  },
};

type Donnees = {
  moment: string;
  nomStagiaire: string;
  reponduLe: string;
  tireeLe: string;
  noteGlobale: number | null;
  commentaire: string | null;
  saisieOrganisme: boolean;
  objectifsAtteints: string | null;
};

function donneesRendues(appel = 0): Donnees {
  return (mockRender.mock.calls[appel]![0] as { props: { data: Donnees } }).props.data;
}

describe("pièces satisfaction répondue (ind. 30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.questionnaire.findMany.mockResolvedValue([]);
  });

  it("ne retient que les questionnaires à chaud / à froid RÉPONDUS sur une session tenue", () => {
    expect(whereSatisfactionRemplie()).toEqual({
      type: { in: ["satisfaction_chaud", "satisfaction_froid"] },
      reponduAt: { not: null },
      enrollment: { session: { statut: { notIn: STATUTS_SESSION_SANS_PREUVE } } },
    });
  });

  it("la liste lit le MÊME prédicat", async () => {
    await produirePiecesSatisfactionRemplie();
    expect(mockPrisma.questionnaire.findMany.mock.calls[0]![0].where).toEqual(
      whereSatisfactionRemplie(),
    );
  });

  it("rend une pièce nominative, datée de la réponse en heure de Paris, rangée sous satisfactions/", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([LIGNE]);
    const { pieces, echecs } = await produirePiecesSatisfactionRemplie();
    expect(echecs).toEqual([]);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.chemin).toBe(
      "satisfactions/2026-09-11_martin-camille-elise_5e6f7a8b_a-chaud.pdf",
    );
    expect(pieces[0]!.saisieOrganisme).toBe(false);
    const d = donneesRendues();
    expect(d.moment).toBe("chaud");
    expect(d.nomStagiaire).toBe("Camille-Élise Martin");
    expect(d.reponduLe).toContain("13 septembre 2026");
    expect(d.noteGlobale).toBe(4);
    expect(d.commentaire).toBe("Très concret");
    expect(d.tireeLe).not.toBe("");
  });

  it("à froid et saisie de l'organisme : nommée comme telle, ses champs restitués", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      {
        ...LIGNE,
        type: "satisfaction_froid",
        noteGlobale: null,
        reponses: { saisie_admin: true, objectifs_atteints: "Oui" },
      },
    ]);
    const { pieces } = await produirePiecesSatisfactionRemplie();
    expect(pieces[0]!.chemin).toBe(
      "satisfactions/2026-09-11_martin-camille-elise_5e6f7a8b_a-froid_saisie-organisme.pdf",
    );
    expect(pieces[0]!.saisieOrganisme).toBe(true);
    expect(pieces[0]!.moment).toBe("froid");
    const d = donneesRendues();
    expect(d.moment).toBe("froid");
    expect(d.saisieOrganisme).toBe(true);
    expect(d.noteGlobale).toBeNull();
    expect(d.commentaire).toBeNull();
    expect(d.objectifsAtteints).toBe("Oui");
  });

  it("🔴 une valeur chiffrée (enc:v1:) ne passe JAMAIS sur la pièce", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      { ...LIGNE, reponses: { commentaire: "enc:v1:abcdef" } },
    ]);
    await produirePiecesSatisfactionRemplie();
    expect(donneesRendues().commentaire).toBeNull();
  });

  it("droit à l'effacement : la fiche anonymisée est restituée telle qu'en base, rien d'autre", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([
      {
        ...LIGNE,
        enrollment: {
          ...LIGNE.enrollment,
          trainee: { nom: "[supprime]", prenom: "[supprime]" },
        },
      },
    ]);
    const { pieces } = await produirePiecesSatisfactionRemplie();
    expect(pieces[0]!.chemin).not.toMatch(/martin|camille/i);
    expect(donneesRendues().nomStagiaire).not.toMatch(/Martin|Camille/);
    // La requête ne lit aucune autre donnée de la fiche que le nom et le prénom.
    const select = mockPrisma.questionnaire.findMany.mock.calls[0]![0].select;
    expect(select.enrollment.select.trainee).toEqual({ select: { nom: true, prenom: true } });
  });

  it("un rendu en échec est RAPPORTÉ, pas avalé", async () => {
    mockPrisma.questionnaire.findMany.mockResolvedValue([LIGNE]);
    mockRender.mockRejectedValueOnce(new Error("police absente"));
    const { pieces, echecs } = await produirePiecesSatisfactionRemplie();
    expect(pieces).toEqual([]);
    expect(echecs).toEqual([
      {
        chemin: "satisfactions/2026-09-11_martin-camille-elise_5e6f7a8b_a-chaud.pdf",
        motif: "police absente",
        saisieOrganisme: false,
        moment: "chaud",
      },
    ]);
  });
});
