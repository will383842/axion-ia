/**
 * Tests e-invoicing (Phase 6) — classification du canal réglementaire +
 * structure/totaux du XML CII EN 16931 (jeu de factures de référence :
 * taxable, exonérée, mixte, avoir).
 */

import { describe, it, expect } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { classifierCanalReglementaire } from "./canal";
import { genererXmlCII, type FactureCIIInput } from "./cii";
import { resolvePaAdapter } from "./pa-adapter";

// ─────────────────────────────────────────────────────────────────────────────
// Canal réglementaire
// ─────────────────────────────────────────────────────────────────────────────

describe("classifierCanalReglementaire", () => {
  const base = {
    activite: "audit" as const,
    regimeTva: "assujetti" as const,
    clientEstPublic: false,
    clientPaysCode: "FR",
    clientEstParticulier: false,
  };

  it("B2B France taxable → PA (e-invoicing, échéance 1/9/2027)", () => {
    expect(classifierCanalReglementaire(base)).toBe("pa_einvoicing");
  });

  it("client secteur public → Chorus Pro (obligation EN VIGUEUR), même exonéré", () => {
    expect(classifierCanalReglementaire({ ...base, clientEstPublic: true })).toBe("chorus_pro");
    expect(
      classifierCanalReglementaire({
        ...base,
        clientEstPublic: true,
        activite: "formation",
        regimeTva: "exoneration_261",
      }),
    ).toBe("chorus_pro");
  });

  it("formation/1-to-1 sous exonération 261-4-4° → hors champ (e-invoicing ET e-reporting)", () => {
    expect(
      classifierCanalReglementaire({
        ...base,
        activite: "formation",
        regimeTva: "exoneration_261",
      }),
    ).toBe("hors_champ");
    expect(
      classifierCanalReglementaire({ ...base, activite: "un_a_un", regimeTva: "exoneration_261" }),
    ).toBe("hors_champ");
  });

  it("audit sous exonération 261 → PA quand même (l'exonération ne couvre pas le conseil)", () => {
    expect(classifierCanalReglementaire({ ...base, regimeTva: "exoneration_261" })).toBe(
      "pa_einvoicing",
    );
  });

  it("client étranger → e-reporting ; particulier (B2C) → e-reporting", () => {
    expect(classifierCanalReglementaire({ ...base, clientPaysCode: "BE" })).toBe("e_reporting");
    expect(classifierCanalReglementaire({ ...base, clientEstParticulier: true })).toBe(
      "e_reporting",
    );
  });

  it("pays null = France (défaut)", () => {
    expect(classifierCanalReglementaire({ ...base, clientPaysCode: null })).toBe("pa_einvoicing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// XML CII EN 16931
// ─────────────────────────────────────────────────────────────────────────────

const VENDEUR = {
  nom: "Axion-IA SAS",
  siret: "12345678900012",
  tvaIntracom: "FR12123456789",
  adresseLigne: "11 Avenue Paul Verlaine",
  codePostal: "38100",
  ville: "Grenoble",
  paysCode: "FR",
};
const ACHETEUR = {
  nom: "Client SARL",
  siret: "98765432100021",
  adresseLigne: "1 rue du Test",
  codePostal: "75001",
  ville: "Paris",
  paysCode: "FR",
};

const FACTURE_TAXABLE: FactureCIIInput = {
  numero: "AXI-FACT-2027-042",
  estAvoir: false,
  dateEmission: new Date("2027-03-15T00:00:00Z"),
  dateEcheance: new Date("2027-04-14T00:00:00Z"),
  refClientCommande: "PO-889",
  vendeur: VENDEUR,
  acheteur: ACHETEUR,
  lignes: [
    { designation: "Audit IA", quantite: 1, prixUnitaireHtCents: 190_000, tauxTvaPercent: 20 },
    { designation: "Restitution", quantite: 2, prixUnitaireHtCents: 45_000, tauxTvaPercent: 20 },
  ],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
  iban: "FR7630001007941234567890185",
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function parse(xml: string): Record<string, never> {
  return parser.parse(xml) as Record<string, never>;
}

function chemin(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

describe("genererXmlCII", () => {
  it("facture taxable : profil EN 16931, TypeCode 380, totaux exacts, IBAN, PO", () => {
    const xml = genererXmlCII(FACTURE_TAXABLE);
    expect(xml).toContain("urn:cen.eu:en16931:2017");
    const doc = parse(xml);
    const inv = chemin(doc, "rsm:CrossIndustryInvoice") as Record<string, unknown>;
    expect(chemin(inv, "rsm:ExchangedDocument", "ram:ID")).toBe("AXI-FACT-2027-042");
    expect(chemin(inv, "rsm:ExchangedDocument", "ram:TypeCode")).toBe(380);
    const settlement = chemin(
      inv,
      "rsm:SupplyChainTradeTransaction",
      "ram:ApplicableHeaderTradeSettlement",
    ) as Record<string, unknown>;
    const totaux = settlement["ram:SpecifiedTradeSettlementHeaderMonetarySummation"] as Record<
      string,
      unknown
    >;
    // 190000 + 2×45000 = 280000 HT → 56000 TVA → 336000 TTC.
    expect(totaux["ram:LineTotalAmount"]).toBe(2800);
    expect(chemin(totaux, "ram:TaxTotalAmount", "#text")).toBe(560);
    expect(totaux["ram:GrandTotalAmount"]).toBe(3360);
    expect(xml).toContain("FR7630001007941234567890185");
    expect(xml).toContain("PO-889");
    // SIRET acheteur (routage annuaire) schémé 0009.
    expect(xml).toContain("98765432100021");
    expect(xml).toContain('schemeID="0009"');
  });

  it("facture exonérée : catégorie E + motif d'exonération", () => {
    const xml = genererXmlCII({
      ...FACTURE_TAXABLE,
      lignes: [{ designation: "Formation IA", quantite: 1, prixUnitaireHtCents: 245_000 }],
      regimeTva: "exoneration_261",
      mentionExoneration: "Exonéré de TVA — article 261-4-4° du CGI",
    });
    expect(xml).toContain(">E<");
    expect(xml).toContain("261-4-4");
    const doc = parse(xml);
    const totaux = chemin(
      doc,
      "rsm:CrossIndustryInvoice",
      "rsm:SupplyChainTradeTransaction",
      "ram:ApplicableHeaderTradeSettlement",
      "ram:SpecifiedTradeSettlementHeaderMonetarySummation",
    ) as Record<string, unknown>;
    expect(chemin(totaux, "ram:TaxTotalAmount", "#text")).toBe(0);
    expect(totaux["ram:GrandTotalAmount"]).toBe(2450);
  });

  it("facture mixte : ventilation par taux (0 % et 20 %) reconstruite", () => {
    const xml = genererXmlCII({
      ...FACTURE_TAXABLE,
      regimeTva: "exoneration_261",
      lignes: [
        { designation: "Formation", quantite: 1, prixUnitaireHtCents: 100_000 },
        { designation: "Conseil", quantite: 1, prixUnitaireHtCents: 50_000, tauxTvaPercent: 20 },
      ],
      mentionExoneration: "Exonéré de TVA — article 261-4-4° du CGI",
    });
    const doc = parse(xml);
    const taxes = chemin(
      doc,
      "rsm:CrossIndustryInvoice",
      "rsm:SupplyChainTradeTransaction",
      "ram:ApplicableHeaderTradeSettlement",
      "ram:ApplicableTradeTax",
    );
    expect(Array.isArray(taxes)).toBe(true);
    expect((taxes as unknown[]).length).toBe(2);
  });

  it("avoir : TypeCode 381, montants négatifs cohérents", () => {
    const xml = genererXmlCII({
      ...FACTURE_TAXABLE,
      numero: "AXI-AVO-2027-003",
      estAvoir: true,
      lignes: [
        {
          designation: "Avoir — Audit IA",
          quantite: 1,
          prixUnitaireHtCents: -190_000,
          tauxTvaPercent: 20,
        },
      ],
    });
    const doc = parse(xml);
    expect(chemin(doc, "rsm:CrossIndustryInvoice", "rsm:ExchangedDocument", "ram:TypeCode")).toBe(
      381,
    );
    expect(xml).toContain("-1900.00");
  });
});

describe("resolvePaAdapter", () => {
  it("PA non configurée → stub qui REFUSE explicitement le dépôt (jamais silencieux)", async () => {
    const adapter = resolvePaAdapter();
    expect(adapter.nom).toBe("stub");
    const result = await adapter.deposerFacture({
      xml: "<xml/>",
      numero: "AXI-FACT-2027-001",
      acheteurSiret: "98765432100021",
    });
    expect(result.statut).toBe("rejetee");
    expect(result.message).toContain("PA_PROVIDER");
  });
});
