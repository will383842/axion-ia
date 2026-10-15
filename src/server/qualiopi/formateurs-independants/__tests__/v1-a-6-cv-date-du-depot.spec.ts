/**
 * V1-A-6 (vérification n° 1) — le CV déposé dans le dossier en ligne n'avait pas de date :
 * la règle « CV de moins de 24 mois » (W-4, contresignature, activation) le tenait pour
 * non daté, donc jamais probant. Mesuré sur le banc : « Pour contresigner, il manque : un
 * CV daté de moins de 24 mois ». Il est désormais daté du jour de sa transmission.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ docCreate: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const client = {
    trainer: { updateMany: async () => ({ count: 1 }) },
    trainerDocument: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: (...a: unknown[]) => m.docCreate(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/pieces/depot-controle", () => ({
  alerteAntivirusLimitee: () => ({ alerter: vi.fn() }),
  controlerPiece: async () => ({ ok: true, typeMime: "application/pdf", taille: 4, sha256: "ab" }),
  chiffrerPieceAuRepos: (b: Uint8Array) => Buffer.from(b),
}));

import { deposerPiece } from "../dossier";
import { cvProbant } from "../garde-activation-complete";

type Vue = Parameters<typeof deposerPiece>[0];

async function deposer(type: "cv" | "rib") {
  m.docCreate.mockResolvedValue({ id: "d1" });
  await deposerPiece({ id: "t1", accesVersion: 1 } as Vue, {
    type,
    nomFichier: `${type}.pdf`,
    octets: new Uint8Array([1, 2, 3, 4]),
    dateEmission: null,
  });
  return (m.docCreate.mock.calls.at(-1)![0] as { data: { dateEmission: Date | null } }).data;
}

beforeEach(() => vi.clearAllMocks());

describe("V1-A-6 — le CV du dossier est daté de sa transmission", () => {
  it("un CV déposé porte la date du jour, et il est probant", async () => {
    const data = await deposer("cv");
    const jour = new Date().toISOString().slice(0, 10);
    expect(data.dateEmission?.toISOString()).toBe(`${jour}T00:00:00.000Z`);
    expect(
      cvProbant(
        [
          {
            type: "cv",
            statutValidation: "valide",
            fichierUrl: null,
            contenu: { trainerDocumentId: "d1" },
            dateEmission: data.dateEmission,
            dateExpiration: null,
          },
        ],
        new Date(),
      ),
    ).toBe(true);
  });

  it("une autre pièce sans date reste sans date (INCHANGÉ)", async () => {
    expect((await deposer("rib")).dateEmission).toBeNull();
  });
});
