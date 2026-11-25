import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  /** Une entrée par autofacture émise dont le virement n'est pas confirmé. */
  autofactures: [] as Array<{ autofactureNumero: string }>,
  presentations: 2,
  pieces: 1,
  casse: false,
  retires: [] as Array<{ apporteurId: string }>,
  propositions: [] as Array<{ presentationId: string; rendezVousCle: string }>,
  evenement: { status: "active" } as { status: string },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    propositionRendezVousPresentation: { findMany: vi.fn(async () => etat.propositions) },
    calendlyEvent: {
      findUnique: vi.fn(async () => ({
        status: etat.evenement.status,
        startTime: new Date("2026-10-14T09:00:00Z"),
        capturedAt: new Date("2026-10-01T09:00:00Z"),
        rencontre: null,
      })),
    },
    presentationEntreprise: {
      findMany: vi.fn(async () => etat.propositions.map((x) => ({ id: x.presentationId }))),
      count: vi.fn(async () => {
        if (etat.casse) throw new Error("base indisponible");
        return etat.presentations;
      }),
    },
    pieceApporteur: { count: vi.fn(async () => etat.pieces) },
    apporteurReseauRetrait: { findMany: vi.fn(async () => etat.retires) },
    commissionApporteur: { groupBy: vi.fn(async () => etat.autofactures) },
  },
}));

import { prisma } from "@/lib/prisma";

import { compterApporteursNav } from "../apporteurs-nav-counts";

const OCTOBRE = new Date("2026-10-15T10:00:00Z");

beforeEach(() => {
  etat.autofactures = [];
  etat.presentations = 2;
  etat.pieces = 1;
  etat.casse = false;
  etat.retires = [];
  etat.propositions = [];
  etat.evenement = { status: "active" };
  vi.unstubAllEnvs();
});

describe("pastilles « Apporteurs d'affaires » : ce qui reste à faire", () => {
  it("compte présentations à traiter et pièces de vigilance déposées, aucun virement à faire", async () => {
    expect(await compterApporteursNav(OCTOBRE)).toEqual({
      presentations: 2,
      propositions: 0,
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

describe("pastille « pièces » : hors apporteurs retirés (relecture de a1, 08/10)", () => {
  it("les pièces d'un apporteur retiré sont exclues du compte", async () => {
    etat.retires = [{ apporteurId: "r-1" }];
    await compterApporteursNav(OCTOBRE);
    const where = vi.mocked(prisma.pieceApporteur.count).mock.calls.at(-1)?.[0]?.where;
    expect(where).toMatchObject({ apporteurId: { notIn: ["r-1"] } });
  });
  it("aucun retiré : aucun filtre ajouté", async () => {
    await compterApporteursNav(OCTOBRE);
    const where = vi.mocked(prisma.pieceApporteur.count).mock.calls.at(-1)?.[0]?.where;
    expect(where).not.toHaveProperty("apporteurId");
  });
});

describe("pastille « rendez-vous proposés » : ce que la console afficherait", () => {
  const proposition = { presentationId: "p1", rendezVousCle: "calendly:ev1" };

  it("un rendez-vous encore valable compte pour 1", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
    etat.propositions = [proposition];
    expect((await compterApporteursNav()).propositions).toBe(1);
  });

  it("un rendez-vous annulé depuis la proposition ne compte plus (la liste est vide, la pastille aussi)", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
    etat.propositions = [proposition];
    etat.evenement = { status: "canceled" };
    expect((await compterApporteursNav()).propositions).toBe(0);
  });

  it("interrupteur éteint : 0", async () => {
    etat.propositions = [proposition];
    expect((await compterApporteursNav()).propositions).toBe(0);
  });
});
