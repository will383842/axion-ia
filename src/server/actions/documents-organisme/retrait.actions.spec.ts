/**
 * CHANTIER QNC, L13 — le retrait d'un document de l'organisme : réservé au
 * super-administrateur, inscrit au journal des effacements, JAMAIS d'effacement
 * physique. Tant que la base ne connaît pas la cible, il est refusé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const db = vi.hoisted(() => ({
  setting: { findUnique: vi.fn() },
  societeDocument: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  consoleDocument: { findUnique: vi.fn(), delete: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  activityLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { retirerDocumentOrganismeAction } from "./retrait.actions";

const ID = "11111111-1111-4111-8111-111111111111";
const ENTREE = { cible: "SocieteDocument", id: ID, motif: "Pièce déposée par erreur, doublon." };

function sqlDe(appel: unknown[]): string {
  return ((appel[0] as TemplateStringsArray) ?? []).join("?");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "sa-1", role: "super_admin" } });
  db.setting.findUnique.mockResolvedValue({ value: { etat: "actif" } });
  db.societeDocument.findUnique.mockResolvedValue({ id: ID });
  db.adminUser.findUnique.mockResolvedValue({ name: "Will" });
  db.activityLog.create.mockResolvedValue({});
  db.$executeRaw.mockResolvedValue(1);
  db.$transaction.mockImplementation(async (f: (tx: typeof db) => unknown) => f(db));
  // Par défaut : la base connaît la cible et le motif, aucun retrait antérieur.
  db.$queryRaw.mockImplementation(async (...a: unknown[]) =>
    sqlDe(a).includes("pg_enum") ? [{ n: 2 }] : [],
  );
});

describe("retirer un document de l'organisme", () => {
  it("un administrateur (non super) ne retire pas", async () => {
    mockAuth.mockResolvedValue({ user: { id: "a", role: "admin" } });
    const res = await retirerDocumentOrganismeAction(ENTREE);
    expect(res).toEqual({ ok: false, error: "Le retrait est réservé au super-administrateur." });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("un motif trop court est refusé", async () => {
    const res = await retirerDocumentOrganismeAction({ ...ENTREE, motif: "erreur" });
    expect(res.ok).toBe(false);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("🔴 GARDE-FOU : la base ne connaît pas la cible → refus, rien n'est écrit", async () => {
    db.$queryRaw.mockResolvedValue([{ n: 0 }]);
    const res = await retirerDocumentOrganismeAction(ENTREE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Rien n'a été retiré/);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("interrupteur éteint → refus, rien n'est écrit", async () => {
    db.setting.findUnique.mockResolvedValue(null);
    const res = await retirerDocumentOrganismeAction(ENTREE);
    expect(res.ok).toBe(false);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("base prête : une ligne au journal des effacements, une trace, AUCUN effacement physique", async () => {
    const res = await retirerDocumentOrganismeAction(ENTREE);
    expect(res).toEqual({ ok: true });
    const inserts = db.$executeRaw.mock.calls.filter((c) =>
      sqlDe(c).includes("effacements_journal"),
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.slice(1)).toEqual(["societe_documents", ID, "retrait_document_organisme"]);
    expect(db.societeDocument.delete).not.toHaveBeenCalled();
    expect(db.societeDocument.update).not.toHaveBeenCalled();
    expect(db.activityLog.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        action: "qualiopi.documents_organisme.retire",
        targetId: ID,
        changes: { motif: ENTREE.motif, auteurNom: "Will" },
      },
    });
  });

  it("un document déjà retiré ne se retire pas deux fois", async () => {
    db.$queryRaw.mockImplementation(async (...a: unknown[]) =>
      sqlDe(a).includes("pg_enum") ? [{ n: 2 }] : [{ ligne_id: ID }],
    );
    const res = await retirerDocumentOrganismeAction(ENTREE);
    expect(res).toEqual({ ok: false, error: "Ce document est déjà retiré." });
  });
});
