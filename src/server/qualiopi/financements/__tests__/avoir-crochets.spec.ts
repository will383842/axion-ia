// @vitest-environment node
/**
 * genererAvoirFacture avec crochets (garantie Journée IA) : transaction forcée, verrou, relecture,
 * annulation sur exception, TTC exact, avoir du reste. Prisma simulé ; le PDF et la numérotation aussi.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const ordre: string[] = [];
  const tx = {
    $executeRaw: vi.fn(async () => {
      ordre.push("verrou");
    }),
    factureFormation: {
      aggregate: vi.fn(async () => ({ _sum: { montantHtCents: 0 } })),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        ordre.push("create");
        return { id: "avoir-1", numero: a.data["numero"] as string };
      }),
    },
  };
  const prisma = {
    factureFormation: {
      findUniqueOrThrow: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { ordre, tx, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/qualiopi/numbering/allocate", () => ({
  nextNumero: vi.fn(async () => "AXI-AVO-2026-001"),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => 20),
}));
vi.mock("@/lib/legal-identity", () => ({ resolveRibFacture: vi.fn(async () => null) }));
vi.mock("@/server/qualiopi/documents/conformite", () => ({ assertOrganismeComplet: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({})),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(async () => ({ id: "doc-1" })),
}));
vi.mock("@/server/qualiopi/documents/templates/facture", () => ({ FacturePdf: () => null }));
const transactionFait = vi.fn(async (p: unknown, fn: (t: unknown) => unknown) => fn(p));
vi.mock("@/server/partners-sync/producteurs/facturation", () => ({
  transactionFaitFacturation: (...a: [unknown, (t: unknown) => unknown]) => transactionFait(...a),
  emettreFaitFacture: vi.fn(async () => null),
  emettreFaitPaiement: vi.fn(async () => null),
}));

import { genererAvoirFacture } from "../facture-libre";

const ORIGINE = {
  id: "fac-1",
  numero: "AXI-FACT-2026-010",
  statut: "payee",
  avoirDeId: null,
  activite: null,
  clientId: "c1",
  refClient: null,
  destinataire: "entreprise",
  destinataireNom: "ACME",
  destinataireSiret: null,
  destinataireTvaIntracom: null,
  destinataireAdresse: null,
  montantHtCents: 149_000,
  montantTvaCents: 29_800,
  montantTtcCents: 178_800,
  regimeTva: "assujetti",
  lignes: [
    { designation: "Journée IA", quantite: 1, prixUnitaireHtCents: 149_000, tauxTvaPercent: 20 },
  ],
  session: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.ordre.length = 0;
  h.prisma.factureFormation.findUniqueOrThrow.mockResolvedValue({ ...ORIGINE });
  h.prisma.factureFormation.aggregate.mockResolvedValue({
    _sum: { montantHtCents: 0, montantTvaCents: 0, montantTtcCents: 0 },
  });
  h.tx.factureFormation.aggregate.mockResolvedValue({ _sum: { montantHtCents: 0 } });
});

describe("genererAvoirFacture avec crochets", () => {
  it("transaction FORCÉE : verrou → avant → create → après, dans cet ordre", async () => {
    const r = await genererAvoirFacture(
      { factureId: "fac-1", montantTtcCents: 60_000, motif: "m" },
      {
        avant: async () => void h.ordre.push("avant"),
        apres: async () => void h.ordre.push("apres"),
      },
    );
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionFait).not.toHaveBeenCalled();
    expect(h.ordre).toEqual(["verrou", "avant", "create", "apres"]);
    expect(r).toMatchObject({ montantHtCents: 50_000, montantTtcCents: 60_000 });
  });
  it("TTC = reste, sans avoir antérieur → négation intégrale : 1 788,00 € TTC / 1 490,00 € HT", async () => {
    const r = await genererAvoirFacture(
      { factureId: "fac-1", montantTtcCents: 178_800, motif: "m" },
      { apres: async () => undefined },
    );
    expect(r).toMatchObject({ montantHtCents: 149_000, montantTtcCents: 178_800 });
    const data = h.tx.factureFormation.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      avoirDeId: "fac-1",
      montantHtCents: -149_000,
      montantTtcCents: -178_800,
    });
  });
  it("une exception dans `apres` remonte (la transaction est annulée par Prisma), pas de PDF", async () => {
    await expect(
      genererAvoirFacture(
        { factureId: "fac-1", montantTtcCents: 60_000, motif: "m" },
        {
          apres: async () => {
            throw new Error("échec garantie");
          },
        },
      ),
    ).rejects.toThrow("échec garantie");
    expect(h.prisma.factureFormation.update).not.toHaveBeenCalled();
  });
  it("une exception dans `avant` empêche toute création", async () => {
    await expect(
      genererAvoirFacture(
        { factureId: "fac-1", montantTtcCents: 60_000, motif: "m" },
        {
          avant: async () => {
            throw new Error("dossier modifié");
          },
        },
      ),
    ).rejects.toThrow("dossier modifié");
    expect(h.tx.factureFormation.create).not.toHaveBeenCalled();
  });
  it("un autre avoir apparu sous verrou → refus « un autre avoir vient d'être émis »", async () => {
    h.tx.factureFormation.aggregate.mockResolvedValue({ _sum: { montantHtCents: -50_000 } });
    await expect(
      genererAvoirFacture(
        { factureId: "fac-1", montantTtcCents: 60_000, motif: "m" },
        { apres: async () => undefined },
      ),
    ).rejects.toThrow(/autre avoir/);
    expect(h.tx.factureFormation.create).not.toHaveBeenCalled();
  });
  it("sans crochet : chemin historique (transactionFaitFacturation), pas de verrou", async () => {
    transactionFait.mockImplementationOnce(async (_p, fn) => fn(h.tx));
    await genererAvoirFacture({ factureId: "fac-1", montantPartielHtCents: 50_000, motif: "m" });
    expect(transactionFait).toHaveBeenCalledTimes(1);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it("HT et TTC ensemble, TTC > reste, TTC inatteignable : refus avant toute création", async () => {
    await expect(
      genererAvoirFacture({
        factureId: "fac-1",
        montantPartielHtCents: 1,
        montantTtcCents: 1,
        motif: "m",
      }),
    ).rejects.toThrow(/ambigu/);
    await expect(
      genererAvoirFacture({ factureId: "fac-1", montantTtcCents: 178_801, motif: "m" }),
    ).rejects.toThrow(/restant rectifiable/);
    await expect(
      genererAvoirFacture({ factureId: "fac-1", montantTtcCents: 3, motif: "m" }),
    ).rejects.toThrow(/impossible au taux/);
    expect(h.tx.factureFormation.create).not.toHaveBeenCalled();
  });
  it("avoir antérieur puis TTC = reste : HT déduit exactement, jamais d'écart d'un centime", async () => {
    h.prisma.factureFormation.aggregate.mockResolvedValue({
      _sum: { montantHtCents: -50_000, montantTvaCents: -10_000, montantTtcCents: -60_000 },
    });
    h.tx.factureFormation.aggregate.mockResolvedValue({ _sum: { montantHtCents: -50_000 } });
    const r = await genererAvoirFacture(
      { factureId: "fac-1", montantTtcCents: 118_800, motif: "m" },
      { apres: async () => undefined },
    );
    expect(r).toMatchObject({ montantHtCents: 99_000, montantTtcCents: 118_800 });
  });
});
