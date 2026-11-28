import { beforeEach, describe, expect, it, vi } from "vitest";

const pieces = vi.hoisted(() => vi.fn());
const apporteurs = vi.hoisted(() => vi.fn());
const virements = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pieceAutofactureApporteur: { findMany: pieces },
    apporteurReseau: { findMany: apporteurs },
    apporteurVirementCompte: { findMany: virements },
  },
}));

import { lireJournal } from "../journal-autofactures";

const piece = (numero: string, emiseAt: string, apporteurId = "a1") => ({
  numero,
  genre: "facture",
  emiseAt: new Date(emiseAt),
  factureRectifiee: null,
  apporteurId,
  regimeTva: "assujetti",
  numeroTva: null,
  totalHtCents: 100,
  totalTvaCents: 20,
  totalTtcCents: 120,
  origine: "emission",
});

beforeEach(() => {
  vi.clearAllMocks();
  apporteurs.mockResolvedValue([{ id: "a1", denomination: "A", siren: "123456789" }]);
  virements.mockResolvedValue([]);
});

describe("lireJournal : période en jours de Paris, bornes incluses", () => {
  it("inclut 23:30Z le 31/10 (= 1er novembre à Paris) pour du=2026-11-01", async () => {
    pieces.mockResolvedValue([piece("AXI-APP-2026-0001", "2026-10-31T23:30:00Z")]);
    const { lignes } = await lireJournal({ du: "2026-11-01", au: "2026-11-30" });
    expect(lignes.map((l) => l.numero)).toEqual(["AXI-APP-2026-0001"]);
  });

  it("exclut 23:30Z le 30/11 (= 1er décembre à Paris) pour au=2026-11-30", async () => {
    pieces.mockResolvedValue([piece("AXI-APP-2026-0002", "2026-11-30T23:30:00Z")]);
    const { lignes } = await lireJournal({ du: "2026-11-01", au: "2026-11-30" });
    expect(lignes).toEqual([]);
  });

  it("inclut une pièce du jour au (borne incluse) et du jour du", async () => {
    pieces.mockResolvedValue([
      piece("AXI-APP-2026-0003", "2026-11-30T10:00:00Z"),
      piece("AXI-APP-2026-0004", "2026-11-01T10:00:00Z"),
    ]);
    const { lignes } = await lireJournal({ du: "2026-11-01", au: "2026-11-30" });
    expect(lignes).toHaveLength(2);
  });

  it("exclut une pièce la veille de du", async () => {
    pieces.mockResolvedValue([piece("AXI-APP-2026-0005", "2026-10-31T10:00:00Z")]);
    expect((await lireJournal({ du: "2026-11-01", au: "2026-11-30" })).lignes).toEqual([]);
  });

  it("la requête garde une marge d'un jour de chaque côté de la période", async () => {
    pieces.mockResolvedValue([]);
    await lireJournal({ du: "2026-11-01", au: "2026-11-30" });
    const { gte, lt } = pieces.mock.calls[0]![0].where.emiseAt;
    expect(gte).toEqual(new Date("2026-10-31T00:00:00Z"));
    expect(lt).toEqual(new Date("2026-12-02T00:00:00Z"));
  });
});

describe("lireJournal : virements", () => {
  it("chaque ligne ne porte que ses propres virements", async () => {
    pieces.mockResolvedValue([
      piece("AXI-APP-2026-0010", "2026-11-05T10:00:00Z"),
      piece("AXI-APP-2026-0011", "2026-11-06T10:00:00Z"),
    ]);
    const v1 = new Date("2026-11-20T10:00:00Z");
    const v2 = new Date("2026-11-21T10:00:00Z");
    virements.mockResolvedValue([
      { autofactureNumero: "AXI-APP-2026-0010", verseAt: v1 },
      { autofactureNumero: "AXI-APP-2026-0011", verseAt: v2 },
    ]);
    const { lignes } = await lireJournal({ du: "2026-11-01", au: "2026-11-30" });
    expect(lignes.find((l) => l.numero === "AXI-APP-2026-0010")!.viree).toEqual([v1]);
    expect(lignes.find((l) => l.numero === "AXI-APP-2026-0011")!.viree).toEqual([v2]);
  });
});
