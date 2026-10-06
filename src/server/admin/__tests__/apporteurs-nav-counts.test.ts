import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  groupes: [] as Array<{ apporteurId: string; _sum: { montantCents: number | null } }>,
  statuts: [] as Array<{ id: string; statut: string }>,
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
    commissionApporteur: { groupBy: vi.fn(async () => etat.groupes) },
    apporteurReseau: { findMany: vi.fn(async () => etat.statuts) },
  },
}));

import { compterApporteursNav } from "../apporteurs-nav-counts";

const OCTOBRE = new Date("2026-10-15T10:00:00Z");
const JANVIER = new Date("2026-01-15T10:00:00Z");

beforeEach(() => {
  etat.groupes = [];
  etat.statuts = [];
  etat.presentations = 2;
  etat.pieces = 1;
  etat.casse = false;
});

describe("pastilles « Apporteurs d'affaires » : ce qui reste à faire", () => {
  it("compte présentations à traiter et pièces de vigilance déposées", async () => {
    expect(await compterApporteursNav(OCTOBRE)).toEqual({ presentations: 2, pieces: 1, releve: 0 });
  });
  it("relevé du mois : seuls les soldes nets au-dessus du seuil comptent", async () => {
    etat.groupes = [
      { apporteurId: "A", _sum: { montantCents: 20_000 } },
      { apporteurId: "B", _sum: { montantCents: 3_000 } },
      { apporteurId: "C", _sum: { montantCents: -4_000 } },
    ];
    etat.statuts = [
      { id: "A", statut: "signe" },
      { id: "B", statut: "signe" },
      { id: "C", statut: "signe" },
    ];
    expect((await compterApporteursNav(OCTOBRE)).releve).toBe(1);
  });
  it("janvier et dernier relevé : plus de seuil, mais jamais un solde nul ou négatif", async () => {
    etat.groupes = [
      { apporteurId: "B", _sum: { montantCents: 3_000 } },
      { apporteurId: "C", _sum: { montantCents: -4_000 } },
    ];
    etat.statuts = [
      { id: "B", statut: "signe" },
      { id: "C", statut: "resilie" },
    ];
    expect((await compterApporteursNav(JANVIER)).releve).toBe(1);
    expect((await compterApporteursNav(OCTOBRE)).releve).toBe(0);
    etat.statuts = [
      { id: "B", statut: "resilie" },
      { id: "C", statut: "resilie" },
    ];
    expect((await compterApporteursNav(OCTOBRE)).releve).toBe(1);
  });
  it("une base indisponible ne fait jamais tomber le menu : le compteur retombe à zéro", async () => {
    etat.casse = true;
    expect((await compterApporteursNav(OCTOBRE)).presentations).toBe(0);
  });
});
