// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  factureFormation: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { resoudreFacturesGarantie } from "../lecture";

const D = { clientId: "c", auditMissionId: null, devisId: "D1", factureId: null };
const fac = (id: string, ht: number, payes: number[], destinataire = "entreprise") => ({
  id,
  numero: id,
  montantHtCents: ht,
  montantTvaCents: Math.round(ht * 0.2),
  montantTtcCents: Math.round(ht * 1.2),
  destinataire,
  regimeTva: "assujetti",
  payments: payes.map((amountCents) => ({ amountCents })),
});
const lots = (factures: unknown[], avoirs: unknown[] = []) =>
  prisma.factureFormation.findMany.mockResolvedValueOnce(factures).mockResolvedValueOnce(avoirs);

beforeEach(() => vi.clearAllMocks());

describe("resoudreFacturesGarantie", () => {
  it("acompte + solde payés : les deux factures, dans l'ordre, avec ce qui est rendable", async () => {
    lots([fac("AC", 44_700, [53_640]), fac("SO", 104_300, [125_160])]);
    const r = await resoudreFacturesGarantie(D);
    expect(r.ok && r.factures.map((f) => [f.id, f.rendableTtcCents])).toEqual([
      ["AC", 53_640],
      ["SO", 125_160],
    ]);
  });
  it("une facture non encaissée ne se rembourse pas (rendable 0) ; un paiement partiel plafonne", async () => {
    lots([fac("AC", 44_700, []), fac("SO", 104_300, [50_000])]);
    const r = await resoudreFacturesGarantie(D);
    expect(r.ok && r.factures.map((f) => f.rendableTtcCents)).toEqual([0, 50_000]);
  });
  it("les avoirs déjà émis sont déduits de l'encaissé", async () => {
    lots(
      [fac("SO", 104_300, [125_160])],
      [
        {
          avoirDeId: "SO",
          montantHtCents: -50_000,
          montantTvaCents: -10_000,
          montantTtcCents: -60_000,
        },
      ],
    );
    const r = await resoudreFacturesGarantie(D);
    expect(r.ok && r.factures[0]?.rendableTtcCents).toBe(65_160);
  });
  it("facture adressée à un financeur : refus clair, aucun avoir (à traiter à la main)", async () => {
    lots([fac("AC", 44_700, [53_640]), fac("SO", 104_300, [125_160], "opco")]);
    const r = await resoudreFacturesGarantie(D);
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("à la main") });
    lots([fac("FT", 104_300, [125_160], "france_travail")]);
    expect(await resoudreFacturesGarantie(D)).toMatchObject({ ok: false });
  });
  it("aucune facture, ou plus rien de rendable : refus", async () => {
    prisma.factureFormation.findMany.mockResolvedValueOnce([]);
    expect(await resoudreFacturesGarantie(D)).toMatchObject({ ok: false });
    lots([fac("SO", 104_300, [])]);
    expect(await resoudreFacturesGarantie(D)).toMatchObject({ ok: false });
  });
  it("périmètre strict : le devis quand il existe (pas la mission), et les remboursements ne comptent pas comme encaissé", async () => {
    lots([fac("SO", 104_300, [125_160])]);
    await resoudreFacturesGarantie({ ...D, auditMissionId: "M1" });
    const where = prisma.factureFormation.findMany.mock.calls[0]?.[0].where;
    expect(where.OR).toEqual([{ devisId: "D1" }]);
    const sel = prisma.factureFormation.findMany.mock.calls[0]?.[0].select;
    expect(sel.payments.where).toEqual({ status: "succeeded", type: { not: "refund" } });
  });
  it("sans devis : la mission ; la facture du reste sans avoir antérieur est atteignable (négation intégrale)", async () => {
    lots([{ ...fac("SO", 104_300, [125_160]), regimeTva: "assujetti" }]);
    const r = await resoudreFacturesGarantie({ ...D, devisId: null, auditMissionId: "M1" });
    expect(prisma.factureFormation.findMany.mock.calls[0]?.[0].where.OR).toEqual([
      { auditMissionId: "M1" },
    ]);
    expect(r.ok && r.factures[0]?.atteignable(125_160)).toBe(true);
  });
});
