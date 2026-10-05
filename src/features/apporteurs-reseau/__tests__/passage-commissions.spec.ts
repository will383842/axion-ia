import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  presentations: [] as unknown[],
  payees: [] as unknown[],
  lignes: [] as unknown[],
  avoirs: [] as unknown[],
  commissions: [] as unknown[],
  crees: [] as Array<Record<string, unknown>>,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async () => true),
  piecesVigilanceValides: vi.fn(async () => true),
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findMany: vi.fn(async (a: { where: { statut?: unknown } }) =>
        typeof a.where.statut === "string" ? [] : etat.presentations,
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    factureFormation: {
      findMany: vi.fn(async (a: { where: { statut?: string; avoirDeId?: unknown } }) => {
        if (a.where.statut === "payee") return etat.payees;
        if (a.where.avoirDeId === null) return etat.lignes;
        return etat.avoirs;
      }),
    },
    commissionApporteur: {
      findMany: vi.fn(async () => etat.commissions),
      groupBy: vi.fn(async () => []),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.crees.push(a.data);
        return a.data;
      }),
    },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => []) },
    apporteurReseau: { findMany: vi.fn(async () => []) },
  },
}));

import { passerReseauApporteurs } from "../passage-quotidien";

const MAINTENANT = new Date("2026-10-05T08:00:00Z");
const protegee = {
  id: "P1",
  apporteurId: "APP1",
  siren: "123456782",
  denomination: "Acme",
  recueAt: new Date("2026-08-01T00:00:00Z"),
  confirmeeAt: new Date("2026-08-05T00:00:00Z"),
  protegeeJusquAt: new Date("2027-02-05T00:00:00Z"),
  apporteur: { prenom: "A", nom: "B", email: "a@b.fr", parrainId: null, signeParSocieteAt: null },
};
const fac = (o: Record<string, unknown>) => ({
  id: "F",
  devisId: "D1",
  statut: "payee",
  avoirDeId: null,
  activite: "audit",
  montantHtCents: 100_000,
  emiseAt: new Date("2026-09-01T00:00:00Z"),
  devis: { acceptedAt: new Date("2026-08-20T00:00:00Z") },
  client: { siren: "123456782" },
  ...o,
});

beforeEach(() => {
  etat.presentations = [protegee];
  etat.payees = [];
  etat.lignes = [];
  etat.avoirs = [];
  etat.commissions = [];
  etat.crees = [];
});

describe("passage quotidien : commission par commande soldée", () => {
  it("acompte payé seul : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [
      fac({ id: "A", montantHtCents: 60_000 }),
      fac({ id: "S", statut: "emise", montantHtCents: 140_000 }),
    ];
    const bilan = await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
    expect(bilan.commissionsCreees).toBe(0);
  });

  it("acompte + solde payés : une commission, 30 % du total HT facturé (audit)", async () => {
    etat.payees = [
      { id: "A", devisId: "D1" },
      { id: "S", devisId: "D1" },
    ];
    etat.lignes = [
      fac({ id: "A", montantHtCents: 60_000, emiseAt: new Date("2026-09-01T00:00:00Z") }),
      fac({ id: "S", montantHtCents: 140_000, emiseAt: new Date("2026-09-20T00:00:00Z") }),
    ];
    const bilan = await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toHaveLength(1);
    expect(etat.crees[0]).toMatchObject({
      factureId: "S",
      apporteurId: "APP1",
      factureHtCents: 200_000,
      montantCents: 60_000,
    });
    expect(bilan.commissionsCreees).toBe(1);
  });

  it("avoir sur la commande : commission sur le HT net de l'avoir", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", montantHtCents: 200_000 })];
    etat.avoirs = [
      {
        id: "AV",
        devisId: "D1",
        statut: "emise",
        avoirDeId: "A",
        montantHtCents: -50_000,
        emiseAt: null,
      },
    ];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees[0]).toMatchObject({ factureHtCents: 150_000, montantCents: 45_000 });
  });

  it("commission déjà créée sur l'acompte (ancien comportement) : jamais doublée sur le solde", async () => {
    etat.payees = [
      { id: "A", devisId: "D1" },
      { id: "S", devisId: "D1" },
    ];
    etat.lignes = [fac({ id: "A" }), fac({ id: "S", emiseAt: new Date("2026-09-20T00:00:00Z") })];
    etat.commissions = [{ factureId: "A", apporteurId: "APP1", parrainage: false }];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("client sans SIREN : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", client: { siren: null } })];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });

  it("commande signée avant la présentation : aucune commission", async () => {
    etat.payees = [{ id: "A", devisId: "D1" }];
    etat.lignes = [fac({ id: "A", devis: { acceptedAt: new Date("2026-07-01T00:00:00Z") } })];
    await passerReseauApporteurs(MAINTENANT);
    expect(etat.crees).toEqual([]);
  });
});
