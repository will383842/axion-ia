import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  /** Une entrée par autofacture émise dont le virement n'est pas confirmé. */
  autofactures: [] as Array<{ autofactureNumero: string }>,
  presentations: 2,
  pieces: 1,
  casse: false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      count: vi.fn(async () => {
        if (etat.casse) throw new Error("base indisponible");
        return etat.presentations;
      }),
    },
    pieceApporteur: { count: vi.fn(async () => etat.pieces) },
    commissionApporteur: { groupBy: vi.fn(async () => etat.autofactures) },
  },
}));

import { compterApporteursNav } from "../apporteurs-nav-counts";

const OCTOBRE = new Date("2026-10-15T10:00:00Z");

beforeEach(() => {
  etat.autofactures = [];
  etat.presentations = 2;
  etat.pieces = 1;
  etat.casse = false;
});

describe("pastilles « Apporteurs d'affaires » : ce qui reste à faire", () => {
  it("compte présentations à traiter et pièces de vigilance déposées, aucun virement à faire", async () => {
    expect(await compterApporteursNav(OCTOBRE)).toEqual({
      presentations: 2,
      pieces: 1,
      virements: 0,
    });
  });
  it("virements à faire : une pastille par autofacture émise et non confirmée, quel que soit son montant", async () => {
    etat.autofactures = [
      { autofactureNumero: "AXI-APP-2026-0001" },
      { autofactureNumero: "AXI-APP-2026-0002" },
    ];
    expect((await compterApporteursNav(OCTOBRE)).virements).toBe(2);
  });
  it("une base indisponible ne fait jamais tomber le menu : le compteur retombe à zéro", async () => {
    etat.casse = true;
    expect((await compterApporteursNav(OCTOBRE)).presentations).toBe(0);
  });
});
