// @vitest-environment node

/** Lot 3c : la lecture des entrées partage la définition Q4 b, lit les frères d'autofacture, ne tronque jamais. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  pieces: vi.fn(),
  commissions: vi.fn(),
  factures: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pieceAutofactureApporteur: { findMany: m.pieces },
    commissionApporteur: { findMany: m.commissions },
    factureFormation: { findMany: m.factures },
  },
}));
vi.mock("../../paiement-integral", () => ({
  paiementsIntegrauxParFacture: async () => new Map(),
}));

import { BORNE_LIGNES_PAR_APPORTEUR, conditionsLecture, lireEntreeReleve } from "../lecture";
import { bornesPeriode, debutAnnee } from "../periode";
import { conditionsCommissionQ4b } from "../statistiques";

const MAINTENANT = new Date("2026-11-03T08:00:00Z");

const brute = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  factureId: `f-${id}`,
  activite: "formation",
  palier: null,
  parrainage: false,
  statut: "versee",
  montantCents: 10_000,
  factureHtCents: 10_000,
  prixPublicHtCents: null,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  avoirNumero: null,
  autofactureAttenteMotif: null,
  autofactureAttenteDepuis: null,
  litigeDepuis: null,
  verseeAt: null,
  creeAt: new Date("2026-10-01T00:00:00Z"),
  majAt: new Date("2026-10-01T00:00:00Z"),
  regleAppliquee: null,
  versionContrat: null,
  presentation: { denomination: "Entreprise fictive" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.pieces.mockResolvedValue([]);
  m.commissions.mockResolvedValue([]);
  m.factures.mockResolvedValue([]);
});

describe("conditionsLecture", () => {
  it("reprend TELLE QUELLE la définition Q4 b partagée avec le ciblage (D1, D2, mouvements du mois)", () => {
    const { debut, coupure } = bornesPeriode("2026-10");
    expect(conditionsLecture("2026-10", [])).toContainEqual(
      conditionsCommissionQ4b(debut, coupure),
    );
  });

  it("couvre l'année civile entière (cumul E) : émission, virement, attente depuis le 1er janvier", () => {
    const { coupure } = bornesPeriode("2026-10");
    const json = JSON.stringify(conditionsLecture("2026-10", []));
    expect(json).toContain(JSON.stringify({ gte: debutAnnee("2026-10"), lt: coupure }));
  });

  it("ajoute les avoirs de l'année par numéro de pièce", () => {
    expect(conditionsLecture("2026-10", ["AXI-APP-2026-0002"])).toContainEqual({
      avoirNumero: { in: ["AXI-APP-2026-0002"] },
    });
  });
});

describe("lireEntreeReleve", () => {
  it("refuse une période non close", async () => {
    await expect(lireEntreeReleve("a1", "2026-11", MAINTENANT)).rejects.toThrow();
  });

  it("filtre TOUJOURS sur l'apporteur et lit aussi les frères de chaque autofacture lue", async () => {
    m.commissions
      .mockResolvedValueOnce([brute("c1", { autofactureNumero: "AXI-APP-2026-0001" })])
      .mockResolvedValueOnce([brute("c2", { autofactureNumero: "AXI-APP-2026-0001" })]);
    const e = await lireEntreeReleve("a1", "2026-10", MAINTENANT);
    expect(e.commissions.map((c) => c.id)).toEqual(["c1", "c2"]);
    const premier = m.commissions.mock.calls[0]![0] as { where: { apporteurId: string } };
    const second = m.commissions.mock.calls[1]![0] as {
      where: { apporteurId: string; autofactureNumero: { in: string[] }; id: { notIn: string[] } };
    };
    expect(premier.where.apporteurId).toBe("a1");
    expect(second.where.apporteurId).toBe("a1");
    expect(second.where.autofactureNumero.in).toEqual(["AXI-APP-2026-0001"]);
    expect(second.where.id.notIn).toEqual(["c1"]);
  });

  it("ne lit aucun frère quand aucune autofacture n'est lue", async () => {
    m.commissions.mockResolvedValueOnce([brute("c1")]);
    await lireEntreeReleve("a1", "2026-10", MAINTENANT);
    expect(m.commissions).toHaveBeenCalledTimes(1);
  });

  it("refuse de tronquer : au-delà de la borne, la lecture échoue", async () => {
    m.commissions.mockResolvedValueOnce(
      Array.from({ length: BORNE_LIGNES_PAR_APPORTEUR + 1 }, (_, i) => brute(`c${i}`)),
    );
    await expect(lireEntreeReleve("a1", "2026-10", MAINTENANT)).rejects.toThrow(/jamais tronquée/);
  });

  it("ne porte aucune donnée personnelle : seule la dénomination de l'entreprise présentée", async () => {
    m.commissions.mockResolvedValueOnce([brute("c1")]);
    const e = await lireEntreeReleve("a1", "2026-10", MAINTENANT);
    expect(e.commissions[0]!.entreprise).toBe("Entreprise fictive");
    expect(Object.keys(e.commissions[0]!).join(",")).not.toMatch(
      /email|telephone|iban|prenom|nom\b/i,
    );
  });
});
