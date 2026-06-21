/**
 * Tests — compta-export.ts (T11 AGENT A, module PUR).
 *
 * Couverture : facturesToCsv — format, échappement, séparateur `;`, montants FR.
 * Aucun mock nécessaire (fonction pure, sans I/O).
 */

import { describe, it, expect } from "vitest";
import { facturesToCsv } from "./compta-export";
import type { FactureCsvRow } from "./compta-export";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFacture(overrides: Partial<FactureCsvRow> = {}): FactureCsvRow {
  return {
    numero: "AXI-FACT-2026-001",
    emiseAt: new Date("2026-06-15T10:00:00.000Z"),
    destinataire: "entreprise",
    montantHtCents: 150_000,
    tvaExoneree: true,
    statut: "emise",
    sessionId: "sess-uuid-1",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// facturesToCsv
// ─────────────────────────────────────────────────────────────────────────────

describe("facturesToCsv", () => {
  it("génère un en-tête avec 10 colonnes séparées par `;` (régime + TVA + TTC)", () => {
    const csv = facturesToCsv([]);
    const header = csv.split("\n")[0]!;
    const cols = header.split(";");
    expect(cols).toHaveLength(10);
  });

  it("retourne seulement l'en-tête si la liste est vide", () => {
    const csv = facturesToCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("génère une ligne par facture (en-tête + N lignes)", () => {
    const csv = facturesToCsv([makeFacture(), makeFacture({ numero: "AXI-FACT-2026-002" })]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2
  });

  it("le numéro est bien la première colonne de la ligne 1", () => {
    const csv = facturesToCsv([makeFacture()]);
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine.split(";")[0]).toBe("AXI-FACT-2026-001");
  });

  it("le montant HT est converti en euros avec virgule (format FR)", () => {
    // 150_000 centimes = 1 500,00 €
    const csv = facturesToCsv([makeFacture({ montantHtCents: 150_000 })]);
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine).toContain("1500,00");
  });

  it("le montant HT avec centimes impairs est bien formaté (ex. 99_950 → 999,50)", () => {
    const csv = facturesToCsv([makeFacture({ montantHtCents: 99_950 })]);
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine).toContain("999,50");
  });

  it("TVA exonérée est `Oui` si tvaExoneree=true", () => {
    const csv = facturesToCsv([makeFacture({ tvaExoneree: true })]);
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine).toContain("Oui");
  });

  it("TVA exonérée est `Non` si tvaExoneree=false", () => {
    const csv = facturesToCsv([makeFacture({ tvaExoneree: false })]);
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine).toContain("Non");
  });

  it("la date est vide si emiseAt est null", () => {
    const csv = facturesToCsv([makeFacture({ emiseAt: null })]);
    const dataLine = csv.split("\n")[1]!;
    const cols = dataLine.split(";");
    // colonne date = index 1
    expect(cols[1]).toBe("");
  });

  it("échappe les champs contenant un point-virgule avec des guillemets doubles", () => {
    const csv = facturesToCsv([makeFacture({ destinataire: "Nom; avec séparateur" })]);
    expect(csv).toContain('"Nom; avec séparateur"');
  });

  it("échappe les guillemets doubles en doublant (RFC 4180)", () => {
    const csv = facturesToCsv([makeFacture({ destinataire: 'Nom "entre guillemets"' })]);
    expect(csv).toContain('"Nom ""entre guillemets"""');
  });

  it("inclut le sessionId en dernière colonne", () => {
    const csv = facturesToCsv([makeFacture({ sessionId: "sess-test-uuid" })]);
    const dataLine = csv.split("\n")[1]!;
    expect(dataLine.endsWith("sess-test-uuid")).toBe(true);
  });

  it("chaque ligne a bien 10 colonnes", () => {
    const factures = [
      makeFacture(),
      makeFacture({ numero: "AXI-FACT-2026-002", destinataire: "opco" }),
    ];
    const csv = facturesToCsv(factures);
    const lines = csv.split("\n");
    for (const line of lines) {
      // Compte les `;` hors guillemets (approximatif ici car pas de champs multi-lignes)
      const rawCount = (line.match(/;/g) ?? []).length;
      expect(rawCount).toBe(9); // 10 colonnes → 9 séparateurs
    }
  });
});
