import { describe, expect, it } from "vitest";

import { construireCsvJournal } from "../journal-autofactures-csv";
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
  totalHtCents: 123_456,
  totalTvaCents: 24_691,
  totalTtcCents: 148_147,
  origine: "emission",
  viree: [new Date("2026-11-20T09:00:00Z")],
};

describe("journal des autofactures — CSV", () => {
  it("commence par le BOM UTF-8 et sépare par des points-virgules", () => {
    const csv = construireCsvJournal([base]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [entete, ligne] = csv.slice(1).split("\r\n");
    expect(entete).toBe(
      "Date;Numéro;Genre;Facture rectifiée;Apporteur;SIREN;Régime TVA;N° TVA;HT;TVA;TTC;Virée le",
    );
    expect(ligne!.split(";")).toHaveLength(12);
  });

  it("écrit les montants en 1234,56 et les dates en JJ/MM/AAAA", () => {
    const l = construireCsvJournal([base]).slice(1).split("\r\n")[1]!.split(";");
    expect(l[0]).toBe("05/11/2026");
    expect(l[8]).toBe("1234,56");
    expect(l[9]).toBe("246,91");
    expect(l[10]).toBe("1481,47");
    expect(l[11]).toBe("20/11/2026");
  });

  it("rend un avoir en positif, avec son genre et la facture rectifiée", () => {
    const avoir: LigneJournal = {
      ...base,
      numero: "AXI-APP-2026-0002",
      genre: "avoir",
      factureRectifiee: "AXI-APP-2026-0001",
      totalHtCents: -10_000,
      totalTvaCents: -2_000,
      totalTtcCents: -12_000,
    };
    const l = construireCsvJournal([avoir]).slice(1).split("\r\n")[1]!.split(";");
    expect(l[2]).toBe("Avoir");
    expect(l[3]).toBe("AXI-APP-2026-0001");
    expect(l[8]).toBe("100,00");
    expect(l[10]).toBe("120,00");
  });

  it("franchise : TVA à 0,00 et pas de numéro de TVA", () => {
    const f: LigneJournal = {
      ...base,
      regimeTva: "franchise_293b",
      numeroTva: null,
      totalTvaCents: 0,
      totalTtcCents: 123_456,
    };
    const l = construireCsvJournal([f]).slice(1).split("\r\n")[1]!.split(";");
    expect(l[6]).toBe("Franchise en base (art. 293 B)");
    expect(l[7]).toBe("");
    expect(l[9]).toBe("0,00");
  });

  it("marque une pièce reprise dont les totaux sont absents", () => {
    const r: LigneJournal = {
      ...base,
      origine: "reprise_migration",
      totalHtCents: null,
      totalTvaCents: null,
      totalTtcCents: null,
    };
    const l = construireCsvJournal([r]).slice(1).split("\r\n")[1]!.split(";");
    expect(l[8]).toBe("Totaux absents (pièce reprise)");
    expect(l[9]).toBe("");
  });

  it("neutralise les séparateurs et les formules dans la dénomination", () => {
    const l = construireCsvJournal([{ ...base, denomination: '=A;"B"' }]);
    expect(l).toContain('"\'=A;""B"""');
  });
});
