/**
 * Tests — bareme-opco-service.ts (Lot 5) : versionnement append-only.
 *
 * Vérifie que creerVersionBaremeOpco ferme les versions ouvertes antérieures
 * (updateMany avec effectiveTo = dateEffet) PUIS crée la nouvelle ligne, dans une
 * transaction. supprimerBaremeOpco délègue à delete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

const txUpdateMany = vi.fn();
const txCreate = vi.fn();
const txFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        baremeOpco: { updateMany: txUpdateMany, create: txCreate, findFirst: txFindFirst },
      }),
    ),
    baremeOpco: { delete: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { creerVersionBaremeOpco, supprimerBaremeOpco } from "./bareme-opco-service";

const mockPrisma = prisma as unknown as { baremeOpco: { delete: MockFn } };

const DATE_EFFET = new Date("2026-07-01T00:00:00.000Z");

describe("creerVersionBaremeOpco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txCreate.mockResolvedValue({ id: "new-id" });
    txFindFirst.mockResolvedValue(null); // par défaut : pas de successeur → version courante
  });

  it("ferme les versions ouvertes antérieures puis crée la nouvelle", async () => {
    const res = await creerVersionBaremeOpco({
      opco: "atlas",
      dateEffet: DATE_EFFET,
      intraHoraireCents: 4200,
    });

    expect(res).toEqual({ id: "new-id" });

    // Fermeture ciblée : même OPCO, ouverts, dateEffet <= nouvelle → effectiveTo = dateEffet.
    expect(txUpdateMany).toHaveBeenCalledTimes(1);
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { opco: "atlas", effectiveTo: null, dateEffet: { lte: DATE_EFFET } },
      data: { effectiveTo: DATE_EFFET },
    });

    // Création de la nouvelle version (champs non fournis → null, structure vide).
    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opco: "atlas",
          intraHoraireCents: 4200,
          plafondAnnuelCents: null,
          perimetre: null,
        }),
      }),
    );
  });

  it("borne une saisie RÉTROACTIVE par son successeur (pas de 2e ligne ouverte)", async () => {
    // Un barème plus récent (successeur) existe déjà → la version intercalée est
    // fermée à la date du successeur, elle ne naît PAS ouverte.
    const dateSuccesseur = new Date("2026-06-01T00:00:00.000Z");
    txFindFirst.mockResolvedValue({ dateEffet: dateSuccesseur });

    await creerVersionBaremeOpco({
      opco: "atlas",
      dateEffet: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(txFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { opco: "atlas", dateEffet: { gt: new Date("2026-01-01T00:00:00.000Z") } },
        orderBy: { dateEffet: "asc" },
        select: { dateEffet: true },
      }),
    );
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ effectiveTo: dateSuccesseur }) }),
    );
  });

  it("crée une version courante (effectiveTo null) sans successeur", async () => {
    txFindFirst.mockResolvedValue(null);
    await creerVersionBaremeOpco({ opco: "akto", dateEffet: DATE_EFFET });
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ effectiveTo: null }) }),
    );
  });

  it("normalise undefined → null pour tous les plafonds optionnels", async () => {
    await creerVersionBaremeOpco({ opco: "akto", dateEffet: DATE_EFFET });
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intraHoraireCents: null,
          interPresentielCents: null,
          interDistancielCents: null,
          plafondFormationCents: null,
          plafondAnnuelCents: null,
          sourceUrl: null,
          releveLe: null,
          note: null,
          createdById: null,
        }),
      }),
    );
  });
});

describe("supprimerBaremeOpco", () => {
  beforeEach(() => vi.clearAllMocks());

  it("délègue à prisma.baremeOpco.delete", async () => {
    mockPrisma.baremeOpco.delete.mockResolvedValue({ id: "x" });
    await supprimerBaremeOpco("x");
    expect(mockPrisma.baremeOpco.delete).toHaveBeenCalledWith({ where: { id: "x" } });
  });
});
