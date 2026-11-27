import { describe, expect, it } from "vitest";

import { construireFec, ErreurFec, COLONNES_FEC } from "../journal-autofactures-fec";
import type { LigneJournal } from "../journal-autofactures-types";

const base: LigneJournal = {
  numero: "AXI-APP-2026-0001",
  genre: "facture",
  emiseAt: new Date("2026-11-05T10:00:00Z"),
  factureRectifiee: null,
  denomination: "Société Exemple",
  siren: "123456789",
  regimeTva: "assujetti",
  numeroTva: "FR12123456789",
  totalHtCents: 100_000,
  totalTvaCents: 20_000,
  totalTtcCents: 120_000,
  origine: "emission",
  viree: [],
};

const lignes = (txt: string) =>
  txt
    .split("\r\n")
    .filter(Boolean)
    .map((l) => l.split("\t"));
const montant = (s: string | undefined) => (!s ? 0 : Number(s.replace(",", ".")));

describe("journal des autofactures — FEC", () => {
  it("a les 18 colonnes dans l'ordre réglementaire", () => {
    expect(COLONNES_FEC).toEqual([
      "JournalCode",
      "JournalLib",
      "EcritureNum",
      "EcritureDate",
      "CompteNum",
      "CompteLib",
      "CompAuxNum",
      "CompAuxLib",
      "PieceRef",
      "PieceDate",
      "EcritureLib",
      "Debit",
      "Credit",
      "EcritureLet",
      "DateLet",
      "ValidDate",
      "Montantdevise",
      "Idevise",
    ]);
    const l = lignes(construireFec([base]));
    expect(l[0]).toEqual([...COLONNES_FEC]);
    for (const x of l) expect(x).toHaveLength(18);
    expect(l[1]![0]).toBe("APP");
    expect(l[1]![1]).toBe("Autofactures apporteurs");
    expect(l[1]![3]).toBe("20261105");
  });

  it("équilibre débit et crédit par pièce : 6222 HT, 44566 TVA, 401 TTC", () => {
    const l = lignes(construireFec([base])).slice(1);
    expect(l.map((x) => x[4])).toEqual(["6222", "44566", "401"]);
    expect(montant(l[0]![11])).toBe(1000);
    expect(montant(l[1]![11])).toBe(200);
    expect(montant(l[2]![12])).toBe(1200);
    expect(l[2]![6]).toBe("APP123456789");
    const d = l.reduce((s, x) => s + montant(x[11]!), 0);
    const c = l.reduce((s, x) => s + montant(x[12]!), 0);
    expect(d).toBeCloseTo(c, 2);
  });

  it("inverse les écritures d'un avoir", () => {
    const l = lignes(
      construireFec([
        {
          ...base,
          genre: "avoir",
          factureRectifiee: "AXI-APP-2026-0001",
          numero: "AXI-APP-2026-0002",
        },
      ]),
    ).slice(1);
    expect(montant(l[0]![12])).toBe(1000);
    expect(montant(l[1]![12])).toBe(200);
    expect(montant(l[2]![11])).toBe(1200);
  });

  it("franchise 293 B : aucune ligne 44566", () => {
    const l = lignes(
      construireFec([
        {
          ...base,
          regimeTva: "franchise_293b",
          numeroTva: null,
          totalTvaCents: 0,
          totalTtcCents: 100_000,
        },
      ]),
    ).slice(1);
    expect(l.map((x) => x[4])).toEqual(["6222", "401"]);
  });

  it("refuse, en listant les numéros, si des totaux sont absents", () => {
    const sans: LigneJournal = {
      ...base,
      numero: "AXI-APP-2026-0007",
      origine: "reprise_migration",
      totalHtCents: null,
      totalTvaCents: null,
      totalTtcCents: null,
    };
    try {
      construireFec([base, sans]);
      throw new Error("aurait dû refuser");
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurFec);
      expect((e as ErreurFec).numeros).toEqual(["AXI-APP-2026-0007"]);
    }
  });

  it("refuse une pièce dont HT + TVA ≠ TTC", () => {
    expect(() => construireFec([{ ...base, totalTtcCents: 119_999 }])).toThrow(ErreurFec);
  });
});
