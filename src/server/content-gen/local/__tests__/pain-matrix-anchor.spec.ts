import { describe, it, expect } from "vitest";
import {
  getSectorPainContext,
  serializePainContextForPrompt,
  SECTOR_PAIN_MATRIX,
} from "@/server/content-gen/kb/sector-pain-matrix";
import {
  buildLocalAnchorBlock,
  villeEconomicToAnchorFacts,
} from "@/server/content-gen/local/local-anchor";

describe("sector-pain-matrix (PH3)", () => {
  it("a des entrées et getSectorPainContext résout (secteur × verticale)", () => {
    expect(SECTOR_PAIN_MATRIX.length).toBeGreaterThan(0);
    const c = getSectorPainContext("comptabilite_finance", "audits");
    expect(c?.painStatement).toBeTruthy();
    expect(c?.benefitMeasured).toBeTruthy();
    expect((c?.sectorLexicon.length ?? 0)).toBeGreaterThan(0);
  });

  it("secteur inexistant → undefined", () => {
    // @ts-expect-error valeur hors union (test runtime tolérant)
    expect(getSectorPainContext("inexistant", "audits")).toBeUndefined();
  });

  it("le serializer N'ÉMET PAS de signal budget (price-gate-safe)", () => {
    const c = getSectorPainContext("comptabilite_finance", "audits");
    expect(c).toBeDefined();
    const s = serializePainContextForPrompt(c!);
    expect(s).not.toMatch(/budget|k€|€\s*\/|typicalBudget/i);
    expect(s).toContain(c!.painStatement);
  });

  it("AUCUNE des 25 entrées sérialisées ne contient de montant € (garde price-gate global)", () => {
    for (const entry of SECTOR_PAIN_MATRIX) {
      const s = serializePainContextForPrompt(entry);
      expect(s, `${entry.secteur}×${entry.verticale}`).not.toMatch(/\d+\s*k?€/);
    }
  });
});

describe("local-anchor (PH3)", () => {
  const fullData = {
    topSectorsNaf: [{ naf: "62", label: "Informatique", source: "x", verifiedOn: "2026" }],
    cciCompetente: { nom: "CCI Lyon Métropole", source: "x", verifiedOn: "2026" },
    statsInsee: { etablissementsActifs: 12345, anneeReference: 2024, source: "x", verifiedOn: "2026" },
    grandsGroupesImplantes: [
      { nom: "Acme", secteur: "Tech", typeImplantation: "siege", source: "x", verifiedOn: "2026" },
    ],
  } as never;

  it("villeEconomicToAnchorFacts mappe les champs SSOT réels", () => {
    const f = villeEconomicToAnchorFacts(fullData, {
      ville: "Lyon",
      departement: "Rhône",
      region: "Auvergne-Rhône-Alpes",
    });
    expect(f?.secteursDominants).toContain("Informatique");
    expect(f?.reseauxConsulaires).toContain("CCI Lyon Métropole");
    expect(f?.economicData.join(" ")).toMatch(/établissements actifs/);
    expect(f?.ecosystemActeurs[0]).toMatch(/Acme/);
  });

  it("données absentes/vides → null (mode dégradé, pas d'invention)", () => {
    expect(villeEconomicToAnchorFacts(undefined, { ville: "X" })).toBeNull();
    expect(villeEconomicToAnchorFacts({} as never, { ville: "X" })).toBeNull();
  });

  it("buildLocalAnchorBlock mode dégradé (kbFacts null) interdit l'invention", () => {
    const b = buildLocalAnchorBlock({ ville: "Lyon", kbFacts: null });
    expect(b).toMatch(/JAMAIS inventer/i);
    expect(b).toContain("Lyon");
  });

  it("buildLocalAnchorBlock mode complet injecte les vraies données", () => {
    const facts = villeEconomicToAnchorFacts(fullData, { ville: "Lyon", departement: "Rhône" });
    const b = buildLocalAnchorBlock({ ville: "Lyon", kbFacts: facts });
    expect(b).toMatch(/ANCRAGE LOCAL OBLIGATOIRE/);
    expect(b).toContain("Informatique");
    expect(b).toMatch(/établissements actifs/);
  });
});
