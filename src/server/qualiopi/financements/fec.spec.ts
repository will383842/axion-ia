/**
 * Tests FEC — invariant comptable central (Σ débits = Σ crédits), structure
 * 18 colonnes, avoirs inversés, encaissements.
 */

import { describe, it, expect } from "vitest";
import { genererFec } from "./fec";

const FACTURES = [
  {
    numero: "AXI-FACT-2026-001",
    dateEmission: new Date("2026-09-10T00:00:00Z"),
    clientNom: "Client A",
    montantHtCents: 200_000,
    montantTvaCents: 40_000,
    montantTtcCents: 240_000,
  },
  {
    // Avoir partiel (montants négatifs).
    numero: "AXI-AVO-2026-001",
    dateEmission: new Date("2026-09-20T00:00:00Z"),
    clientNom: "Client A",
    montantHtCents: -50_000,
    montantTvaCents: -10_000,
    montantTtcCents: -60_000,
  },
  {
    // Facture exonérée (TVA 0 → pas de ligne 44571).
    numero: "AXI-FACT-2026-002",
    dateEmission: new Date("2026-10-01T00:00:00Z"),
    clientNom: "Client B",
    montantHtCents: 245_000,
    montantTvaCents: 0,
    montantTtcCents: 245_000,
  },
];

const ENCAISSEMENTS = [
  {
    factureNumero: "AXI-FACT-2026-001",
    clientNom: "Client A",
    date: new Date("2026-10-05T00:00:00Z"),
    montantCents: 180_000,
    reference: "VIR-4471",
  },
];

function sommeColonne(fec: string, index: number): number {
  return fec
    .split("\r\n")
    .slice(1)
    .reduce((acc, ligne) => {
      const val = ligne.split("\t")[index] ?? "0,00";
      return acc + Math.round(Number.parseFloat(val.replace(",", ".")) * 100);
    }, 0);
}

describe("genererFec", () => {
  const fec = genererFec(FACTURES, ENCAISSEMENTS);

  it("en-tête : 18 colonnes officielles (arrêté du 29/07/2013)", () => {
    const header = fec.split("\r\n")[0] ?? "";
    expect(header.split("\t")).toHaveLength(18);
    expect(header).toContain("JournalCode");
    expect(header).toContain("EcritureLib");
    expect(header).toContain("Idevise");
  });

  it("INVARIANT : Σ débits = Σ crédits (partie double)", () => {
    const debits = sommeColonne(fec, 11);
    const credits = sommeColonne(fec, 12);
    expect(debits).toBe(credits);
    expect(debits).toBeGreaterThan(0);
  });

  it("facture taxable : 3 écritures (411 débit TTC / 706 crédit HT / 44571 crédit TVA)", () => {
    const lignes = fec.split("\r\n").filter((l) => l.includes("AXI-FACT-2026-001\t"));
    // 3 écritures de vente + 2 d'encaissement (piece = numéro facture).
    expect(lignes).toHaveLength(5);
    expect(fec).toContain("445710");
  });

  it("facture exonérée : pas de ligne TVA", () => {
    const lignes = fec.split("\r\n").filter((l) => l.includes("AXI-FACT-2026-002"));
    expect(lignes).toHaveLength(2);
  });

  it("avoir : sens inversés (411 au crédit)", () => {
    const ligne411 = fec
      .split("\r\n")
      .find((l) => l.includes("AXI-AVO-2026-001") && l.includes("411000"));
    expect(ligne411).toBeDefined();
    const cols = (ligne411 ?? "").split("\t");
    expect(cols[11]).toBe("0,00"); // débit vide
    expect(cols[12]).toBe("600,00"); // crédit 600 €
  });

  it("montants à la virgule (norme DGFiP), dates AAAAMMJJ", () => {
    expect(fec).toContain("2400,00");
    expect(fec).toContain("20260910");
  });
});
