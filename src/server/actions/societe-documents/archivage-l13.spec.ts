/**
 * CHANTIER QNC, L13 — la rubrique Société ARCHIVE au lieu d'effacer.
 *
 * Interrupteur `qualiopi.documents_organisme.actif` :
 *   - `actif` : remplacer crée une nouvelle pièce et GARDE l'ancienne, avec son
 *     fichier ; supprimer est refusé ; une version remplacée est figée ;
 *   - `eteint` (ou clé absente) : rien ne change — le comportement d'avant le
 *     lot, que `documents.actions.spec.ts` continue de vérifier tel quel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const db = vi.hoisted(() => {
  const fn = () => vi.fn();
  const d = {
    setting: { findUnique: fn() },
    societeDocument: {
      create: fn(),
      update: fn(),
      delete: fn(),
      findFirst: fn(),
      findUnique: fn(),
    },
    activityLog: { create: fn(), findFirst: fn() },
    $executeRaw: fn(),
    $transaction: fn(),
  };
  return d;
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const appels: string[] = [];
vi.mock("@/server/console-documents/storage", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/console-documents/storage")>();
  return {
    ...reel,
    storeConsoleDoc: vi.fn(async (_b: Buffer, nom: string) => {
      appels.push(`store:${nom}`);
      return { storagePath: `/vol/${nom}`, hashSha256: "b".repeat(64) };
    }),
    deleteConsoleDocFile: vi.fn(async (p: string) => {
      appels.push(`delete:${p}`);
    }),
  };
});

import {
  modifierSocieteDocAction,
  remplacerFichierSocieteDocAction,
  supprimerSocieteDocAction,
} from "./documents.actions";

const ANCIEN = "11111111-1111-4111-8111-111111111111";
const NOUVEAU = "22222222-2222-4222-8222-222222222222";

function fichier(nom = "kbis-2026-10.pdf"): File {
  const octets = new Uint8Array([1, 2, 3]);
  const f = new File([octets], nom, { type: "application/pdf" });
  if (typeof f.arrayBuffer !== "function") {
    Object.defineProperty(f, "arrayBuffer", { value: async () => octets.buffer.slice(0) });
  }
  return f;
}

function fd(champs: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

const PIECE = {
  id: ANCIEN,
  type: "kbis",
  titre: "Kbis",
  description: "Extrait de juillet",
  numeroPiece: null,
  dateEmission: new Date("2026-07-01T00:00:00Z"),
  dateExpiration: new Date("2026-10-01T00:00:00Z"),
  sensitive: false,
  sortOrder: 3,
  storagePath: "/vol/ancien.pdf",
  hashSha256: "a".repeat(64),
};

function interrupteur(etat: "actif" | "essai" | "eteint" | null): void {
  db.setting.findUnique.mockResolvedValue(etat === null ? null : { value: { etat } });
}

beforeEach(() => {
  vi.clearAllMocks();
  appels.length = 0;
  mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  db.societeDocument.findUnique.mockResolvedValue(PIECE);
  db.societeDocument.create.mockResolvedValue({ id: NOUVEAU });
  db.societeDocument.update.mockResolvedValue({});
  db.activityLog.create.mockResolvedValue({});
  db.activityLog.findFirst.mockResolvedValue(null);
  db.$executeRaw.mockResolvedValue(1);
  db.$transaction.mockImplementation(async (f: (tx: typeof db) => unknown) => f(db));
});

describe("interrupteur ACTIF — remplacer garde l'ancien", () => {
  beforeEach(() => interrupteur("actif"));

  it("crée une NOUVELLE pièce, ne réécrit ni ne supprime l'ancienne, ni son fichier", async () => {
    const res = await remplacerFichierSocieteDocAction(
      fd({ id: ANCIEN, file: fichier(), dateExpiration: "2027-01-01" }),
    );
    expect(res).toEqual({ ok: true });
    expect(db.societeDocument.update).not.toHaveBeenCalled();
    expect(db.societeDocument.delete).not.toHaveBeenCalled();
    expect(appels).toEqual(["store:kbis-2026-10.pdf"]);

    const cree = db.societeDocument.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(cree.data).toMatchObject({
      type: "kbis",
      titre: "Kbis",
      description: "Extrait de juillet",
      sortOrder: 3,
      storagePath: "/vol/kbis-2026-10.pdf",
      hashSha256: "b".repeat(64),
      // date fournie : prise ; date vide : celle de l'ancienne version
      dateEmission: PIECE.dateEmission,
      dateExpiration: new Date("2027-01-01T00:00:00.000Z"),
      uploadedById: "admin-1",
    });
  });

  it("étiquette l'ancienne « remplacée par » au journal, DANS la transaction", async () => {
    await remplacerFichierSocieteDocAction(fd({ id: ANCIEN, file: fichier() }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const ligne = db.activityLog.create.mock.calls
      .map((c) => (c[0] as { data: Record<string, unknown> }).data)
      .find((d) => d["action"] === "qualiopi.documents_organisme.remplace");
    expect(ligne).toMatchObject({
      adminUserId: "admin-1",
      targetType: "SocieteDocument",
      targetId: ANCIEN,
      changes: { nouveauId: NOUVEAU, hashAvant: "a".repeat(64), hashApres: "b".repeat(64) },
    });
  });

  it("sans trace, pas de nouvelle version : l'échec du journal fait échouer le geste", async () => {
    db.activityLog.create.mockRejectedValue(new Error("base indisponible"));
    await expect(
      remplacerFichierSocieteDocAction(fd({ id: ANCIEN, file: fichier() })),
    ).rejects.toThrow();
    expect(appels.some((a) => a.startsWith("delete:"))).toBe(false);
  });

  it("une version déjà remplacée ne se remplace pas une seconde fois", async () => {
    db.activityLog.findFirst.mockResolvedValue({ id: "ligne-1" });
    const res = await remplacerFichierSocieteDocAction(fd({ id: ANCIEN, file: fichier() }));
    expect(res.ok).toBe(false);
    expect(db.societeDocument.create).not.toHaveBeenCalled();
  });

  it("supprimer est refusé : rien n'est lu pour être détruit, rien n'est effacé", async () => {
    const res = await supprimerSocieteDocAction(fd({ id: ANCIEN }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ne se supprime plus/);
    expect(db.societeDocument.delete).not.toHaveBeenCalled();
    expect(appels).toEqual([]);
  });

  it("une version remplacée est figée : ses métadonnées ne se modifient plus", async () => {
    db.activityLog.findFirst.mockResolvedValue({ id: "ligne-1" });
    const res = await modifierSocieteDocAction(
      fd({ id: ANCIEN, type: "kbis", titre: "Kbis corrigé" }),
    );
    expect(res.ok).toBe(false);
    expect(db.societeDocument.update).not.toHaveBeenCalled();
  });

  it("modifier une version en vigueur garde l'avant et l'après complets au journal", async () => {
    const res = await modifierSocieteDocAction(
      fd({ id: ANCIEN, type: "kbis", titre: "Kbis corrigé", dateExpiration: "2026-11-01" }),
    );
    expect(res).toEqual({ ok: true });
    const ligne = db.activityLog.create.mock.calls
      .map((c) => (c[0] as { data: Record<string, unknown> }).data)
      .find((d) => d["action"] === "societe.document.modifie");
    expect(ligne?.["changes"]).toMatchObject({
      avant: { titre: "Kbis", dateExpiration: "2026-10-01T00:00:00.000Z" },
      apres: { titre: "Kbis corrigé", dateExpiration: "2026-11-01T00:00:00.000Z" },
    });
  });
});

describe("interrupteur ÉTEINT (ou essai : ces pièces n'ont pas de session) — rien ne change", () => {
  for (const etat of [null, "eteint", "essai"] as const) {
    it(`${etat ?? "clé absente"} : remplacer réécrit la ligne comme avant le lot`, async () => {
      interrupteur(etat);
      const res = await remplacerFichierSocieteDocAction(fd({ id: ANCIEN, file: fichier() }));
      expect(res).toEqual({ ok: true });
      expect(db.societeDocument.create).not.toHaveBeenCalled();
      expect(db.societeDocument.update).toHaveBeenCalledTimes(1);
      expect(appels).toEqual(["store:kbis-2026-10.pdf", "delete:/vol/ancien.pdf"]);
    });

    it(`${etat ?? "clé absente"} : supprimer supprime comme avant le lot`, async () => {
      interrupteur(etat);
      const res = await supprimerSocieteDocAction(fd({ id: ANCIEN }));
      expect(res).toEqual({ ok: true });
      expect(db.societeDocument.delete).toHaveBeenCalledTimes(1);
    });
  }
});
