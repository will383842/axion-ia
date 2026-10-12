// @vitest-environment node

/**
 * Lot D2 (M10) — numéro et PDF de l'AVOIR d'une autofacture de mission.
 *   · même série que les factures (`autofacture`), montants POSITIFS sur la pièce,
 *     renvoi à la facture annulée ; le TTC de la pièce est contre-vérifié
 *     (65 000 + 13 000 = 78 000) avant tout numéro ;
 *   · idempotent : un avoir déjà numéroté rend son numéro, rien n'est réémis ;
 *   · jamais pour un relevé mensuel ni pour une pièce qui n'est pas un avoir.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const updateMany = vi.fn();
const genere = vi.fn();
const numero = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      findMany: vi.fn(async () => []),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));
vi.mock("@/server/qualiopi/remuneration/verrou-emission-autofacture", () => ({
  avecVerrouEmissionAutofacture: async (t: () => Promise<unknown>) => ({
    acquis: true,
    valeur: await t(),
  }),
}));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({
  nextNumero: (...a: unknown[]) => numero(...a),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => genere(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({})),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { emettrePieceAvoirMission } from "./autofacture-emission";

const A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function avoir(over: Record<string, unknown> = {}) {
  return {
    id: A,
    origine: "passage_mission",
    trainerId: "t",
    tvaRegime: "assujetti_20",
    totalTtcCents: -78_000,
    numeroFacture: null,
    autofactureDocumentId: null,
    periodeYear: 2026,
    periodeMonth: 11,
    avoirDe: {
      numeroFacture: "AXI-AUTOF-2026-0007",
      dateFacture: new Date("2026-11-25T10:00:00Z"),
      echeanceAt: new Date("2026-12-16T12:00:00Z"),
    },
    trainer: {
      nom: "N",
      prenom: "P",
      email: "f@exemple.test",
      siret: "12345678900011",
      numeroTvaIntracom: null,
      adresseProfessionnelle: "1 rue X",
    },
    feeLines: [
      {
        prestationType: "formation_collective",
        heures: null,
        montantHtCents: -60_000,
        objet: "ajustement",
      },
      {
        prestationType: "formation_collective",
        heures: null,
        montantHtCents: -5_000,
        objet: "ajustement",
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(avoir());
  updateMany.mockResolvedValue({ count: 1 });
  numero.mockResolvedValue("AXI-AUTOF-2026-0009");
  genere.mockResolvedValue({ id: "doc-a", numero: "D", hashSha256: "h" });
});

describe("emettrePieceAvoirMission", () => {
  it("numérote dans la série des autofactures et écrit sous condition (numéro encore vide)", async () => {
    expect(await emettrePieceAvoirMission(A)).toEqual({
      numero: "AXI-AUTOF-2026-0009",
      documentId: "doc-a",
    });
    expect(numero.mock.calls[0]![0]).toBe("autofacture");
    expect(genere).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: A, numeroFacture: null },
      data: { numeroFacture: "AXI-AUTOF-2026-0009", autofactureDocumentId: "doc-a" },
    });
  });

  it("déjà numéroté : rend son numéro, aucun nouveau numéro ni PDF", async () => {
    findUnique.mockResolvedValue(
      avoir({ numeroFacture: "AXI-AUTOF-2026-0009", autofactureDocumentId: "doc-a" }),
    );
    expect(await emettrePieceAvoirMission(A)).toEqual({
      numero: "AXI-AUTOF-2026-0009",
      documentId: "doc-a",
    });
    expect(numero).not.toHaveBeenCalled();
    expect(genere).not.toHaveBeenCalled();
  });

  it("TTC de la pièce différent de l'avoir écrit : rien n'est émis", async () => {
    findUnique.mockResolvedValue(avoir({ totalTtcCents: -77_999 }));
    expect(await emettrePieceAvoirMission(A)).toBeNull();
    expect(numero).not.toHaveBeenCalled();
  });

  it("relevé mensuel, ou pièce qui n'est pas un avoir : rien", async () => {
    findUnique.mockResolvedValue(avoir({ origine: "releve_mensuel" }));
    expect(await emettrePieceAvoirMission(A)).toBeNull();
    findUnique.mockResolvedValue(avoir({ avoirDe: null }));
    expect(await emettrePieceAvoirMission(A)).toBeNull();
    expect(numero).not.toHaveBeenCalled();
  });
});
