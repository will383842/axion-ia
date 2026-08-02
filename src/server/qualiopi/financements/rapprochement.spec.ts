/**
 * Tests — rapprochement.ts (module PUR, rapprochement bancaire Finom v1).
 *
 * Couverture : parsing de l'export CSV Finom réel (ligne SCARPA vérifiée sur
 * un fichier de Will, montants quotés, BOM, CRLF, en-tête invalide) et
 * matching crédit → facture (exact montant+nom, montant seul, nom seul avec
 * écart < 5 %, facture suggérée une seule fois, débits exclus).
 * Aucun mock nécessaire (fonctions pures, sans I/O).
 */

import { describe, it, expect } from "vitest";
import { parseFinomStatement, suggererRapprochements } from "./rapprochement";
import type { FactureOuvertePourMatch, LigneReleve } from "./rapprochement";

const ENTETE = "Date Complété UTC,Nom Contrepartie,Référence,Montant payé";

function ligne(
  montantCents: number,
  contrepartie = "ACME",
  reference: string | null = null,
): LigneReleve {
  return { date: new Date(Date.UTC(2026, 7, 1)), contrepartie, reference, montantCents };
}

function facture(over: Partial<FactureOuvertePourMatch> = {}): FactureOuvertePourMatch {
  return {
    id: "f1",
    numero: "AXI-FACT-2026-001",
    destinataireNom: "ACME SAS",
    clientNom: "ACME SAS",
    resteDuCents: 100_000,
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// parseFinomStatement
// ─────────────────────────────────────────────────────────────────────────────

describe("parseFinomStatement", () => {
  it("parse la ligne réelle SCARPA (montant quoté à virgule, référence N/A)", () => {
    const csv = `${ENTETE}\n01/08/2026,SCARPA,N/A,"-11,50"`;
    const { lignes, erreurs } = parseFinomStatement(csv);
    expect(erreurs).toEqual([]);
    expect(lignes).toHaveLength(1);
    const l = lignes[0];
    expect(l?.date.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(l?.contrepartie).toBe("SCARPA");
    expect(l?.reference).toBeNull();
    expect(l?.montantCents).toBe(-1150);
  });

  it("gère les champs quotés avec virgules internes (contrepartie ET montant à milliers)", () => {
    const csv = `${ENTETE}\n15/07/2026,"DURAND, MARTIN ET FILS",VIR-42,"1 234,56"`;
    const { lignes, erreurs } = parseFinomStatement(csv);
    expect(erreurs).toEqual([]);
    expect(lignes[0]?.contrepartie).toBe("DURAND, MARTIN ET FILS");
    expect(lignes[0]?.reference).toBe("VIR-42");
    expect(lignes[0]?.montantCents).toBe(123_456);
  });

  it("accepte BOM + CRLF + lignes vides, et un guillemet doublé littéral", () => {
    const bom = String.fromCharCode(0xfeff);
    const csv = `${bom}${ENTETE}\r\n01/08/2026,"SOC ""ALPHA""",N/A,"250,00"\r\n\r\n`;
    const { lignes, erreurs } = parseFinomStatement(csv);
    expect(erreurs).toEqual([]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.contrepartie).toBe('SOC "ALPHA"');
    expect(lignes[0]?.montantCents).toBe(25_000);
  });

  it("refuse un en-tête inconnu avec un message explicite", () => {
    const csv = `Date,Libelle,Montant\n01/08/2026,SCARPA,-11,50`;
    const { lignes, erreurs } = parseFinomStatement(csv);
    expect(lignes).toEqual([]);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("ne ressemble pas à un relevé Finom");
    expect(erreurs[0]).toContain("Date Complété UTC");
  });

  it("signale ligne par ligne les dates et montants illisibles sans jeter le reste", () => {
    const csv = [
      ENTETE,
      '32/13/2026,BAD DATE,N/A,"10,00"', // date impossible
      "01/08/2026,BAD MONTANT,N/A,abc", // montant illisible
      '02/08/2026,OK SARL,REF-1,"99,90"',
    ].join("\n");
    const { lignes, erreurs } = parseFinomStatement(csv);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.contrepartie).toBe("OK SARL");
    expect(lignes[0]?.reference).toBe("REF-1");
    expect(lignes[0]?.montantCents).toBe(9990);
    expect(erreurs).toHaveLength(2);
    expect(erreurs[0]).toContain("Ligne 2");
    expect(erreurs[0]).toContain("date");
    expect(erreurs[1]).toContain("Ligne 3");
    expect(erreurs[1]).toContain("montant");
  });

  it("un crédit (montant positif sans guillemets) est parsé signé positif", () => {
    const csv = `${ENTETE}\n01/08/2026,CLIENT SARL,N/A,1500`;
    const { lignes } = parseFinomStatement(csv);
    expect(lignes[0]?.montantCents).toBe(150_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// suggererRapprochements
// ─────────────────────────────────────────────────────────────────────────────

describe("suggererRapprochements", () => {
  it("montant exact + nom retrouvé → niveau « exact »", () => {
    const suggestions = suggererRapprochements([ligne(100_000, "ACME")], [facture()]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.niveau).toBe("exact");
    expect(suggestions[0]?.facture?.id).toBe("f1");
  });

  it("le nom matche aussi via normalisation accents/casse et containment inverse", () => {
    const suggestions = suggererRapprochements(
      [ligne(100_000, "Société Générale Épargne")],
      [facture({ destinataireNom: "societe generale", clientNom: null })],
    );
    expect(suggestions[0]?.niveau).toBe("exact");
  });

  it("montant exact seul (nom sans rapport) → niveau « probable »", () => {
    const suggestions = suggererRapprochements([ligne(100_000, "ZZZ INCONNU")], [facture()]);
    expect(suggestions[0]?.niveau).toBe("probable");
    expect(suggestions[0]?.facture?.id).toBe("f1");
  });

  it("nom seul avec écart de montant < 5 % → « probable » ; écart > 5 % → « aucune »", () => {
    // 96 000 sur un reste dû de 100 000 = 4 % d'écart → probable.
    const proches = suggererRapprochements([ligne(96_000, "ACME")], [facture()]);
    expect(proches[0]?.niveau).toBe("probable");
    expect(proches[0]?.facture?.id).toBe("f1");
    // 90 000 = 10 % d'écart → aucune suggestion malgré le nom.
    const lointains = suggererRapprochements([ligne(90_000, "ACME")], [facture()]);
    expect(lointains[0]?.niveau).toBe("aucune");
    expect(lointains[0]?.facture).toBeNull();
  });

  it("une facture n'est suggérée qu'une fois — le meilleur crédit la prend", () => {
    // Deux crédits au même montant : celui dont le NOM matche (score exact)
    // doit prendre la facture ; l'autre reste sans correspondance.
    const suggestions = suggererRapprochements(
      [ligne(100_000, "ZZZ INCONNU"), ligne(100_000, "ACME")],
      [facture()],
    );
    const exact = suggestions.find((s) => s.niveau === "exact");
    const aucune = suggestions.find((s) => s.niveau === "aucune");
    expect(exact?.ligne.contrepartie).toBe("ACME");
    expect(exact?.facture?.id).toBe("f1");
    expect(aucune?.ligne.contrepartie).toBe("ZZZ INCONNU");
    expect(aucune?.facture).toBeNull();
  });

  it("les débits (montants négatifs ou nuls) sont exclus du rapprochement", () => {
    const suggestions = suggererRapprochements(
      [ligne(-1150, "ACME"), ligne(0, "ACME")],
      [facture()],
    );
    expect(suggestions).toEqual([]);
  });

  it("retour trié : exacts, puis probables, puis sans correspondance", () => {
    const suggestions = suggererRapprochements(
      [
        ligne(555, "PERSONNE"), // aucune
        ligne(50_000, "ZZZ"), // probable (montant exact seul sur f2)
        ligne(100_000, "ACME"), // exact sur f1
      ],
      [
        facture(),
        facture({
          id: "f2",
          numero: "AXI-FACT-2026-002",
          destinataireNom: "BETA",
          clientNom: "BETA",
          resteDuCents: 50_000,
        }),
      ],
    );
    expect(suggestions.map((s) => s.niveau)).toEqual(["exact", "probable", "aucune"]);
  });

  it("deux factures au même reste dû : chaque crédit prend la sienne par le nom", () => {
    const suggestions = suggererRapprochements(
      [ligne(100_000, "BETA"), ligne(100_000, "ACME")],
      [
        facture(),
        facture({
          id: "f2",
          numero: "AXI-FACT-2026-002",
          destinataireNom: "BETA SARL",
          clientNom: null,
        }),
      ],
    );
    const parNom = new Map(suggestions.map((s) => [s.ligne.contrepartie, s]));
    expect(parNom.get("ACME")?.facture?.id).toBe("f1");
    expect(parNom.get("BETA")?.facture?.id).toBe("f2");
    expect(suggestions.every((s) => s.niveau === "exact")).toBe(true);
  });
});
