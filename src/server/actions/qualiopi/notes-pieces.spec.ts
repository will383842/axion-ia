/**
 * CHANTIER QNC, L13 — une note sur une pièce d'un dossier CLOS s'ajoute sans
 * toucher la pièce : datée par le serveur, signée de l'auteur réel, en ajout
 * seul. Éteint : refus, rien n'est écrit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  setting: { findUnique: vi.fn() },
  documentGenere: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  adminUser: { findUnique: vi.fn() },
  activityLog: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const assertDossierOuvert = vi.hoisted(() => vi.fn());
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: "admin" })),
  assertDossierOuvert,
  donneesJournalQualiopi: vi.fn(
    async (i: {
      action: string;
      targetType: string;
      targetId: string;
      changes: unknown;
      session: { userId: string };
    }) => ({
      adminUserId: i.session.userId,
      action: i.action,
      targetType: i.targetType,
      targetId: i.targetId,
      changes: i.changes,
      ipAddress: null,
      userAgent: null,
    }),
  ),
}));

import { ajouterNotePieceAction } from "./notes-pieces";

const PIECE = "11111111-1111-4111-8111-111111111111";
const SERVEUR = new Date("2026-10-17T07:42:00Z");
const NOTE = {
  documentId: PIECE,
  mention: "piece_vierge",
  texte: "Numéro 034 consommé à vide, rien à remettre.",
};

function piece(estTestInterne: boolean): void {
  db.documentGenere.findUnique.mockResolvedValue({
    id: PIECE,
    numero: "AXI-DOC-2026-034",
    sessionId: "s-1",
    session: { estTestInterne },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  piece(false);
  db.setting.findUnique.mockResolvedValue({ value: { etat: "actif" } });
  db.adminUser.findUnique.mockResolvedValue({ name: "William Jullin" });
  db.activityLog.create.mockResolvedValue({ id: "n-1", createdAt: SERVEUR });
});

describe("note sur une pièce close", () => {
  it("s'ajoute SANS toucher la pièce, ni appeler la garde du verrou", async () => {
    const res = await ajouterNotePieceAction(NOTE);
    expect(res).toEqual({
      ok: true,
      note: { id: "n-1", le: SERVEUR.toISOString(), auteurNom: "William Jullin" },
    });
    expect(db.documentGenere.update).not.toHaveBeenCalled();
    expect(db.documentGenere.updateMany).not.toHaveBeenCalled();
    expect(db.documentGenere.delete).not.toHaveBeenCalled();
    expect(assertDossierOuvert).not.toHaveBeenCalled();
  });

  it("l'auteur est lu en base, la date posée par le serveur — rien du navigateur", async () => {
    await ajouterNotePieceAction({
      ...NOTE,
      // champs qu'un navigateur pourrait glisser : ignorés
      ...({ auteurNom: "Quelqu'un d'autre", le: "2020-01-01" } as object),
    });
    const data = (db.activityLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> })
      .data;
    expect(data).toMatchObject({
      adminUserId: "admin-1",
      action: "qualiopi.documents_organisme.note_piece",
      targetType: "DocumentGenere",
      targetId: PIECE,
      changes: { mention: "piece_vierge", auteurNom: "William Jullin" },
    });
    expect(data).not.toHaveProperty("createdAt");
    expect(JSON.stringify(data)).not.toMatch(/Quelqu'un|2020-01-01/);
  });

  it("une note trop courte ou à mention inconnue est refusée", async () => {
    expect((await ajouterNotePieceAction({ ...NOTE, texte: "vierge" })).ok).toBe(false);
    expect((await ajouterNotePieceAction({ ...NOTE, mention: "effacer" })).ok).toBe(false);
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });

  it("sans auteur identifiable, pas de note", async () => {
    db.adminUser.findUnique.mockResolvedValue(null);
    expect((await ajouterNotePieceAction(NOTE)).ok).toBe(false);
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });

  it("si la trace ne s'écrit pas, l'action échoue (pas de note fantôme)", async () => {
    db.activityLog.create.mockRejectedValue(new Error("base indisponible"));
    await expect(ajouterNotePieceAction(NOTE)).rejects.toThrow();
  });
});

describe("interrupteur", () => {
  it("éteint (clé absente) : refus, rien n'est écrit", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    expect((await ajouterNotePieceAction(NOTE)).ok).toBe(false);
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });

  it("essai : seulement sur une pièce d'une session du banc d'essai", async () => {
    db.setting.findUnique.mockResolvedValue({ value: { etat: "essai" } });
    expect((await ajouterNotePieceAction(NOTE)).ok).toBe(false);
    piece(true);
    expect((await ajouterNotePieceAction(NOTE)).ok).toBe(true);
  });
});
