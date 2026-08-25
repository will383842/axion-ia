/**
 * Communiqués — la DATE DE DIFFUSION doit être saisissable, et écrite.
 *
 * Défaut corrigé : `publishedAt` n'était posé que par le premier clic
 * « Publier » et n'était modifiable par aucun écran. La date de la carte
 * /presse, le `datePublished` du JSON-LD NewsArticle et le `<lastmod>` du
 * sitemap valaient donc l'instant du clic — jamais la date réelle du
 * communiqué. Un CP rédigé la veille, ou importé en lot, sortait daté du jour.
 *
 * Ces tests vérifient l'ÉCRITURE (ce que reçoit Prisma), pas la présence d'un
 * champ dans un formulaire : un `<input name="publishedAt">` que l'action
 * ignorerait serait vert sur un test de présence et faux en production.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
const findFirstMock = vi.fn();
const txUpdateMock = vi.fn();
const trFindUniqueMock = vi.fn();
const trUpdateMock = vi.fn();
const findFirstTranslationMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role: "admin" } })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/server/console-documents/storage", () => ({
  storeConsoleDoc: vi.fn(async () => ({ storagePath: "/vol/cp.pdf", hashSha256: "h" })),
  deleteConsoleDocFile: vi.fn(async () => undefined),
  sanitizeConsoleDocFileName: (n: string) => n,
  CONSOLE_DOC_MAX_BYTES: 10 * 1024 * 1024,
}));

vi.mock("@/server/press/pdf-extract", () => ({ pdfBufferToText: vi.fn(async () => "<p>x</p>") }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pressRelease: {
      create: (...a: unknown[]) => createMock(...a),
      findFirst: (...a: unknown[]) => findFirstMock(...a),
    },
    pressReleaseTranslation: {
      findFirst: (...a: unknown[]) => findFirstTranslationMock(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        pressRelease: { update: (...a: unknown[]) => txUpdateMock(...a) },
        pressReleaseTranslation: {
          findUnique: (...a: unknown[]) => trFindUniqueMock(...a),
          update: (...a: unknown[]) => trUpdateMock(...a),
        },
      }),
  },
}));

import { createPressRelease, updatePressRelease } from "./releases";

/**
 * PDF minimal accepté par `validateAndStorePdf` (extension + MIME).
 * L'environnement de test ne fournit pas `File.arrayBuffer()` — on le complète,
 * sinon l'action échoue pour une raison sans rapport avec ce qu'on mesure.
 */
function pdfFile(): File {
  const bytes = new Uint8Array([1, 2, 3]);
  const f = new File([bytes], "cp.pdf", { type: "application/pdf" });
  if (typeof f.arrayBuffer !== "function") {
    Object.defineProperty(f, "arrayBuffer", { value: async () => bytes.buffer });
  }
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue({ id: "r1" });
  findFirstMock.mockResolvedValue({ id: "r1", pdfStoragePath: "/vol/old.pdf" });
  findFirstTranslationMock.mockResolvedValue(null); // aucun conflit de slug
  trFindUniqueMock.mockResolvedValue({ id: "t1" });
});

describe("createPressRelease · date de diffusion", () => {
  it("🔴 écrit la date SAISIE, et non l'instant de la création", async () => {
    const fd = new FormData();
    fd.set("title", "Axion-IA publie son étude");
    fd.set("tag", "study");
    fd.set("status", "published");
    fd.set("publishedAt", "2026-03-09");
    fd.set("file", pdfFile());

    const res = await createPressRelease(fd);
    expect(res.ok).toBe(true);

    const data = createMock.mock.calls[0]![0].data as { publishedAt?: Date };
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.publishedAt!.toISOString().slice(0, 10)).toBe("2026-03-09");
  });

  it("sans date saisie, un brouillon ne se voit poser aucune date (comportement conservé)", async () => {
    const fd = new FormData();
    fd.set("title", "Brouillon sans date");
    fd.set("tag", "milestone");
    fd.set("status", "draft");
    fd.set("file", pdfFile());

    await createPressRelease(fd);
    const data = createMock.mock.calls[0]![0].data as { publishedAt?: Date };
    expect(data.publishedAt).toBeUndefined();
  });

  it("refuse une date mal formée plutôt que d'en inventer une", async () => {
    const fd = new FormData();
    fd.set("title", "Date invalide");
    fd.set("tag", "product");
    fd.set("publishedAt", "09/03/2026");
    fd.set("file", pdfFile());

    const res = await createPressRelease(fd);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/AAAA-MM-JJ/);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("updatePressRelease · date de diffusion", () => {
  it("🔴 corrige la date d'un communiqué déjà publié", async () => {
    const fd = new FormData();
    fd.set("publishedAt", "2026-07-14");

    const res = await updatePressRelease("r1", fd);
    expect(res.ok).toBe(true);

    const data = txUpdateMock.mock.calls[0]![0].data as { publishedAt?: Date };
    expect(data.publishedAt!.toISOString().slice(0, 10)).toBe("2026-07-14");
  });

  it("un formulaire sans le champ ne touche pas à la date existante", async () => {
    const fd = new FormData();
    fd.set("dek", "Nouveau résumé");

    await updatePressRelease("r1", fd);
    const call = txUpdateMock.mock.calls[0];
    // Soit aucune écriture sur la release, soit une écriture sans `publishedAt`.
    if (call) {
      expect((call[0].data as Record<string, unknown>).publishedAt).toBeUndefined();
    }
  });
});
