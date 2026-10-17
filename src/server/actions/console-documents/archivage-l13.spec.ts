/**
 * CHANTIER QNC, L13 — le hub Documents ARCHIVE au lieu d'effacer.
 *
 * `actif` : supprimer est refusé ; remplacer crée un nouveau document et garde
 * l'ancien, fichier compris. `eteint` : rien ne change (la suppression d'avant
 * le lot, et le remplacement n'existe pas).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const db = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    setting: { findUnique: fn() },
    consoleDocument: { create: fn(), delete: fn(), findFirst: fn(), findUnique: fn() },
    activityLog: { create: fn(), findFirst: fn() },
    $executeRaw: fn(),
    $transaction: fn(),
  };
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

import { deleteConsoleDocAction, remplacerConsoleDocAction } from "./documents.actions";

const ANCIEN = "11111111-1111-4111-8111-111111111111";
const NOUVEAU = "22222222-2222-4222-8222-222222222222";

function fichier(nom = "plaquette-v2.pdf"): File {
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

function interrupteur(etat: "actif" | "essai" | "eteint" | null): void {
  db.setting.findUnique.mockResolvedValue(etat === null ? null : { value: { etat } });
}

beforeEach(() => {
  vi.clearAllMocks();
  appels.length = 0;
  mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  db.consoleDocument.findUnique.mockResolvedValue({
    section: "autres",
    title: "Plaquette",
    description: null,
    sensitive: false,
    sortOrder: 2,
    storagePath: "/vol/plaquette.pdf",
    hashSha256: "a".repeat(64),
  });
  db.consoleDocument.create.mockResolvedValue({ id: NOUVEAU });
  db.activityLog.create.mockResolvedValue({});
  db.activityLog.findFirst.mockResolvedValue(null);
  db.$executeRaw.mockResolvedValue(1);
  db.$transaction.mockImplementation(async (f: (tx: typeof db) => unknown) => f(db));
});

describe("interrupteur ACTIF", () => {
  beforeEach(() => interrupteur("actif"));

  it("supprimer est refusé, sans rien lire ni effacer", async () => {
    const res = await deleteConsoleDocAction(fd({ id: ANCIEN }));
    expect(res.ok).toBe(false);
    expect(db.consoleDocument.delete).not.toHaveBeenCalled();
    expect(appels).toEqual([]);
  });

  it("remplacer crée un nouveau document, garde l'ancien et son fichier, trace « remplacé par »", async () => {
    const res = await remplacerConsoleDocAction(fd({ id: ANCIEN, file: fichier() }));
    expect(res).toEqual({ ok: true });
    expect(db.consoleDocument.delete).not.toHaveBeenCalled();
    expect(appels).toEqual(["store:plaquette-v2.pdf"]);
    expect(db.consoleDocument.create.mock.calls[0]?.[0]).toMatchObject({
      data: { section: "autres", title: "Plaquette", sortOrder: 2, uploadedById: "admin-1" },
    });
    const ligne = db.activityLog.create.mock.calls
      .map((c) => (c[0] as { data: Record<string, unknown> }).data)
      .find((d) => d["action"] === "qualiopi.documents_organisme.remplace");
    expect(ligne).toMatchObject({
      targetType: "ConsoleDocument",
      targetId: ANCIEN,
      changes: { nouveauId: NOUVEAU },
    });
  });

  it("un document déjà remplacé ne se remplace pas deux fois", async () => {
    db.activityLog.findFirst.mockResolvedValue({ id: "l" });
    const res = await remplacerConsoleDocAction(fd({ id: ANCIEN, file: fichier() }));
    expect(res.ok).toBe(false);
    expect(db.consoleDocument.create).not.toHaveBeenCalled();
  });

  it("un rôle « editor » ne remplace pas (même règle que la suppression d'avant)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "e", role: "editor" } });
    const res = await remplacerConsoleDocAction(fd({ id: ANCIEN, file: fichier() }));
    expect(res).toEqual({ ok: false, error: "Droits insuffisants." });
  });
});

describe("interrupteur ÉTEINT — rien ne change", () => {
  for (const etat of [null, "eteint", "essai"] as const) {
    it(`${etat ?? "clé absente"} : supprimer supprime comme avant, remplacer n'existe pas`, async () => {
      interrupteur(etat);
      expect(await deleteConsoleDocAction(fd({ id: ANCIEN }))).toEqual({ ok: true });
      expect(db.consoleDocument.delete).toHaveBeenCalledTimes(1);
      const rep = await remplacerConsoleDocAction(fd({ id: ANCIEN, file: fichier() }));
      expect(rep.ok).toBe(false);
      expect(db.consoleDocument.create).not.toHaveBeenCalled();
    });
  }
});
