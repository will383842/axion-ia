/**
 * Le nom d'origine d'une pièce déposée depuis le dossier à jeton est nettoyé comme celui du
 * dépôt de « Mon dossier » (`nomPropre`) : ni chemin, ni balise.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  trainerUpdateMany: vi.fn(),
  docFindFirst: vi.fn(),
  docUpdateMany: vi.fn(),
  docCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    trainer: { updateMany: (...a: unknown[]) => m.trainerUpdateMany(...a) },
    trainerDocument: {
      findFirst: (...a: unknown[]) => m.docFindFirst(...a),
      updateMany: (...a: unknown[]) => m.docUpdateMany(...a),
      create: (...a: unknown[]) => m.docCreate(...a),
    },
    activityLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/pieces/depot-controle", () => ({
  alerteAntivirusLimitee: () => ({ alerter: vi.fn() }),
  controlerPiece: async () => ({ ok: true, typeMime: "application/pdf", taille: 4, sha256: "ab" }),
  chiffrerPieceAuRepos: (b: Uint8Array) => Buffer.from(b),
}));

import { deposerPiece } from "../dossier";

beforeEach(() => {
  vi.clearAllMocks();
  m.trainerUpdateMany.mockResolvedValue({ count: 1 });
  m.docFindFirst.mockResolvedValue(null);
  m.docUpdateMany.mockResolvedValue({ count: 0 });
  m.docCreate.mockResolvedValue({ id: "d1" });
});

describe("deposerPiece (dossier à jeton) — nom d'origine", () => {
  it("🔴 nettoie le nom : ni chemin ni balise", async () => {
    const r = await deposerPiece(
      { id: "t1", accesVersion: 1 } as Parameters<typeof deposerPiece>[0],
      {
        type: "cv",
        nomFichier: "../../etc/<b>cv.pdf",
        octets: new Uint8Array([1, 2, 3, 4]),
        dateEmission: null,
      } as Parameters<typeof deposerPiece>[1],
    );
    expect(r).toEqual({ ok: true });
    const data = (m.docCreate.mock.calls[0]![0] as {
      data: { contenu: { create: { nomOriginal: string } } };
    }).data;
    expect(data.contenu.create.nomOriginal).toBe("_b_cv.pdf");
  });
});
