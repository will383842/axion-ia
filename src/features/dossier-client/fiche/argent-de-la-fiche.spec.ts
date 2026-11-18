import { describe, expect, it } from "vitest";
import {
  dejaFactureCents,
  dejaFactureHtCents,
  devisEnAttente,
  montantHt,
  montantTtc,
  paiementPartiel,
  resteMelangeHtTtc,
  type FacturePourArgent,
} from "./argent-de-la-fiche";

const f = (o: Partial<FacturePourArgent>): FacturePourArgent => ({
  statut: "emise",
  avoirDeId: null,
  montantHtCents: 100000,
  montantTtcCents: 120000,
  payments: [],
  avoirs: [],
  ...o,
});

describe("dejaFacture", () => {
  it("exclut brouillon et annulée", () => {
    const r = dejaFactureCents([
      f({}),
      f({ statut: "brouillon" }),
      f({ statut: "annulee", montantHtCents: 999999 }),
    ]);
    expect(r).toEqual({ htCents: 100000, ttcCents: 120000, nbSansTtc: 0 });
  });
  it("déduit l'avoir (montant négatif) une seule fois, ignore l'avoir annulé et la ligne d'avoir de la liste", () => {
    const r = dejaFactureCents([
      f({
        avoirs: [
          { montantHtCents: -20000, montantTtcCents: -24000, statut: "emise" },
          { montantHtCents: -50000, montantTtcCents: -60000, statut: "annulee" },
        ],
      }),
      f({ avoirDeId: "x", montantHtCents: -20000, montantTtcCents: -24000 }),
    ]);
    expect(r.htCents).toBe(80000);
    expect(r.ttcCents).toBe(96000);
  });
  it("signale le repli HT quand le TTC est NULL", () => {
    const r = dejaFactureCents([f({ montantTtcCents: null })]);
    expect(r).toEqual({ htCents: 100000, ttcCents: 100000, nbSansTtc: 1 });
  });
  it("garde les centimes", () => {
    expect(dejaFactureHtCents([f({ montantHtCents: 10050 }), f({ montantHtCents: 3333 })])).toBe(
      13383,
    );
  });
});

describe("devisEnAttente", () => {
  it("ne compte que les devis envoyés", () => {
    expect(
      devisEnAttente([
        { statut: "envoye", montantTotalHtCents: 10000 },
        { statut: "envoye", montantTotalHtCents: 5050 },
        { statut: "accepte", montantTotalHtCents: 99999 },
        { statut: "brouillon", montantTotalHtCents: 1 },
      ]),
    ).toEqual({ nombre: 2, htCents: 15050 });
  });
});

describe("paiementPartiel", () => {
  it("donne reçu et reste via resteDuNetCents", () => {
    const r = paiementPartiel(
      f({
        statut: "partiellement_payee",
        payments: [
          { amountCents: 72000, status: "succeeded" },
          { amountCents: 5, status: "failed" },
        ],
      }),
    );
    expect(r).toEqual({ recuCents: 72000, resteCents: 48000 });
  });
  it("null si rien reçu, soldée ou avoir", () => {
    expect(paiementPartiel(f({}))).toBeNull();
    expect(
      paiementPartiel(
        f({ statut: "payee", payments: [{ amountCents: 120000, status: "succeeded" }] }),
      ),
    ).toBeNull();
    expect(paiementPartiel(f({ avoirDeId: "x" }))).toBeNull();
  });
});

describe("formats", () => {
  it("suffixes HT / TTC et espaces insécables", () => {
    expect(montantHt(120000)).toBe("1 200 € HT");
    expect(montantTtc(144050)).toBe("1 440,50 € TTC");
  });
});

describe("resteMelangeHtTtc", () => {
  const base = {
    montantTtcCents: 1200 as number | null,
    avoirs: [] as FacturePourArgent["avoirs"],
  };
  it("faux quand tout a un TTC", () => {
    expect(resteMelangeHtTtc(base)).toBe(false);
  });
  it("vrai quand la facture n'a pas de TTC", () => {
    expect(resteMelangeHtTtc({ ...base, montantTtcCents: null })).toBe(true);
  });
  it("vrai pour un avoir non annulé sans TTC, faux s'il est annulé", () => {
    const avoir = { montantHtCents: -100, montantTtcCents: null, statut: "emise" };
    expect(resteMelangeHtTtc({ ...base, avoirs: [avoir] })).toBe(true);
    expect(resteMelangeHtTtc({ ...base, avoirs: [{ ...avoir, statut: "annulee" }] })).toBe(false);
  });
});
