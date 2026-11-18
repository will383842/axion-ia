/**
 * SEC-1c — dépôt d'un document console : le type stocké vient de l'extension.
 * Avant : `!okExt && !okMime` laissait passer `x.pdf` déclaré `text/html`, stocké tel quel
 * puis servi en ligne.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const db = vi.hoisted(() => ({
  consoleDocument: { create: vi.fn(), findFirst: vi.fn() },
  activityLog: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const appels: string[] = [];
vi.mock("@/server/console-documents/storage", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/console-documents/storage")>();
  return {
    ...reel,
    storeConsoleDoc: vi.fn(async (_b: Buffer, nom: string) => {
      appels.push(`store:${nom}`);
      return { storagePath: `/vol/${nom}`, hashSha256: "c".repeat(64) };
    }),
  };
});

import { uploadConsoleDocAction } from "./documents.actions";

function fichier(nom: string, type: string): File {
  const octets = new Uint8Array([1, 2, 3]);
  const f = new File([octets], nom, { type });
  if (typeof f.arrayBuffer !== "function") {
    Object.defineProperty(f, "arrayBuffer", { value: async () => octets.buffer.slice(0) });
  }
  return f;
}

function fd(file: File): FormData {
  const f = new FormData();
  f.set("section", "autres");
  f.set("title", "Pièce");
  f.set("file", file);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  appels.length = 0;
  mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  db.consoleDocument.findFirst.mockResolvedValue(null);
  db.consoleDocument.create.mockResolvedValue({ id: "d1" });
  db.activityLog.create.mockResolvedValue({});
});

describe("dépôt console : types de fichiers", () => {
  it("x.pdf déclaré text/html est refusé", async () => {
    const res = await uploadConsoleDocAction(fd(fichier("x.pdf", "text/html")));
    expect(res.ok).toBe(false);
    expect(appels).toEqual([]);
    expect(db.consoleDocument.create).not.toHaveBeenCalled();
  });

  it("x.html déclaré application/pdf est refusé", async () => {
    const res = await uploadConsoleDocAction(fd(fichier("x.html", "application/pdf")));
    expect(res.ok).toBe(false);
    expect(db.consoleDocument.create).not.toHaveBeenCalled();
  });

  it("x.pdf sans type est accepté et stocké application/pdf", async () => {
    const res = await uploadConsoleDocAction(fd(fichier("x.pdf", "")));
    expect(res).toEqual({ ok: true });
    expect(db.consoleDocument.create.mock.calls[0]?.[0]?.data.mimeType).toBe("application/pdf");
  });

  it("le type stocké vient de l'extension, pas du type déclaré (jpeg en .png déclaré image/jpeg)", async () => {
    const res = await uploadConsoleDocAction(fd(fichier("x.png", "image/jpeg")));
    expect(res).toEqual({ ok: true });
    expect(db.consoleDocument.create.mock.calls[0]?.[0]?.data.mimeType).toBe("image/png");
  });
});
