/**
 * Lot E (M13) — refus d'une pièce par MOTIF FERMÉ, et suite de la décision.
 *
 * Le motif libre reste accepté tel quel (salariés, cas particuliers). Un motif fermé
 * s'écrit par son libellé et part dans F41 ; une validation lève le blocage des
 * missions (`apresDecisionPiece`). La suite ne défait jamais la décision.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  trainerDocument: { findUnique: vi.fn(), update: vi.fn() },
  activityLog: { findFirst: vi.fn() },
}));
const apres = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/qualiopi/formateurs-independants/pieces-decision", () => ({
  apresDecisionPiece: apres,
}));

import { validateTrainerDocumentAction } from "./trainer-documents";

const DOC_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  db.trainerDocument.findUnique.mockResolvedValue({
    type: "assurance_rc_pro",
    fichierUrl: "https://drive.example/rc.pdf",
    contenu: null,
    dateEmission: null,
    dateExpiration: null,
    archiveAt: null,
    rejetMotif: null,
  });
  db.trainerDocument.update.mockResolvedValue({ id: DOC_ID });
  apres.mockResolvedValue({ etat: "fait", f41: true, f57: false, missions: 0 });
});

describe("validateTrainerDocumentAction — motif fermé (lot E)", () => {
  it("un motif fermé suffit et s'écrit par son libellé", async () => {
    const r = await validateTrainerDocumentAction({
      id: DOC_ID,
      statutValidation: "rejete",
      motifFerme: "illisible",
    });
    expect(r).toEqual({ data: { id: DOC_ID } });
    const arg = db.trainerDocument.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data["rejetMotif"]).toBe("illisible");
    expect(apres).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: DOC_ID, decision: "rejete", motifFerme: "illisible" }),
    );
  });

  it("un motif hors de la liste est refusé", async () => {
    const r = await validateTrainerDocumentAction({
      id: DOC_ID,
      statutValidation: "rejete",
      motifFerme: "flou" as never,
    });
    expect(r).toHaveProperty("error");
    expect(db.trainerDocument.update).not.toHaveBeenCalled();
  });

  it("le motif libre garde son comportement : écrit tel quel, aucun motif fermé transmis", async () => {
    await validateTrainerDocumentAction({
      id: DOC_ID,
      statutValidation: "rejete",
      rejetMotif: "Document illisible",
    });
    const arg = db.trainerDocument.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data["rejetMotif"]).toBe("Document illisible");
    expect(apres).toHaveBeenCalledWith(expect.objectContaining({ motifFerme: null }));
  });

  it("une validation appelle la suite (blocage des missions, F57)", async () => {
    await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(apres).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: DOC_ID, decision: "valide" }),
    );
  });

  it("une suite en échec ne défait pas la décision", async () => {
    apres.mockRejectedValue(new Error("panne"));
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toEqual({ data: { id: DOC_ID } });
  });
});
