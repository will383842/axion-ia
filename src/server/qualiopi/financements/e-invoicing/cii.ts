/**
 * E-invoicing (Phase 6) — génération XML EN 16931, syntaxe UN/CEFACT CII
 * (CrossIndustryInvoice D16B), profil EN 16931.
 *
 * C'est le format d'ÉCHANGE de la réforme 2026/2027 : la Plateforme Agréée
 * convertit entre les 3 syntaxes du socle (Factur-X / UBL / CII) — produire
 * un CII valide suffit, le PDF react-pdf existant reste la copie lisible
 * (décision plan : pas de PDF/A-3 hybride).
 *
 * Champs couverts (BT = Business Terms EN 16931) : numéro BT-1, type BT-3
 * (380 facture / 381 avoir), date BT-2, devise BT-5, réf. acheteur BT-13,
 * vendeur BG-4 (nom, SIRET BT-30, TVA BT-31, adresse BG-5), acheteur BG-7
 * (nom, SIRET BT-47, TVA BT-48, adresse BG-8), lignes BG-25 (qté, PU HT,
 * taux TVA), ventilation TVA BG-23, totaux BG-22, échéance BT-9, IBAN BT-84.
 *
 * Module PUR (pas de DB) : les données arrivent résolues. La validation
 * Schematron officielle (CII_EN16931) se joue côté PA/outillage externe —
 * les tests vérifient ici la structure et les totaux.
 */

import { XMLBuilder } from "fast-xml-parser";
import { computeTotauxFacture, type RegimeTva } from "@/server/qualiopi/legal/tva";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";

export interface PartieCII {
  nom: string;
  /** SIRET (schémé 0009 dans PartyIdentification). */
  siret?: string;
  /** N° TVA intracommunautaire (BT-31/BT-48). */
  tvaIntracom?: string;
  adresseLigne?: string;
  codePostal?: string;
  ville?: string;
  /** ISO 3166-1 alpha-2 — obligatoire (BT-40/BT-55). */
  paysCode: string;
}

export interface FactureCIIInput {
  numero: string;
  /** true = avoir (TypeCode 381, montants déjà négatifs dans les lignes). */
  estAvoir: boolean;
  dateEmission: Date;
  dateEcheance?: Date;
  refClientCommande?: string;
  vendeur: PartieCII;
  acheteur: PartieCII;
  lignes: LigneFacture[];
  regimeTva: RegimeTva;
  tauxTvaStandardPercent: number;
  /** IBAN du vendeur (BT-84) — recommandé pour le virement. */
  iban?: string;
  /** Mention d'exonération (BT-120) si TVA à 0. */
  mentionExoneration?: string;
}

const eur = (cents: number): string => (cents / 100).toFixed(2);
const dateCII = (d: Date): string =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;

/** Catégorie TVA UNTDID 5305 : S = taux standard, E = exonéré, Z = taux zéro. */
function categorieTva(tauxPercent: number, exoneration: boolean): "S" | "E" | "Z" {
  if (tauxPercent > 0) return "S";
  return exoneration ? "E" : "Z";
}

function partieVersXml(partie: PartieCII, tvaKey: string): Record<string, unknown> {
  return {
    ...(partie.siret !== undefined
      ? { "ram:ID": { "@_schemeID": "0009", "#text": partie.siret } }
      : {}),
    "ram:Name": partie.nom,
    "ram:PostalTradeAddress": {
      ...(partie.codePostal !== undefined ? { "ram:PostcodeCode": partie.codePostal } : {}),
      ...(partie.adresseLigne !== undefined ? { "ram:LineOne": partie.adresseLigne } : {}),
      ...(partie.ville !== undefined ? { "ram:CityName": partie.ville } : {}),
      "ram:CountryID": partie.paysCode,
    },
    ...(partie.tvaIntracom !== undefined
      ? {
          [tvaKey]: {
            "ram:ID": { "@_schemeID": "VA", "#text": partie.tvaIntracom },
          },
        }
      : {}),
  };
}

/**
 * Génère le XML CII EN 16931 d'une facture (ou d'un avoir). Retourne la
 * chaîne XML (UTF-8, déclaration incluse).
 */
export function genererXmlCII(input: FactureCIIInput): string {
  const totaux = computeTotauxFacture(input.lignes, input.regimeTva, input.tauxTvaStandardPercent);
  const exoneration = input.regimeTva !== "assujetti";

  // Ventilation par taux (BG-23) — reconstruite depuis les lignes.
  const parTaux = new Map<number, { baseCents: number; tvaCents: number }>();
  for (const ligne of input.lignes) {
    const taux =
      ligne.tauxTvaPercent !== undefined
        ? ligne.tauxTvaPercent
        : input.regimeTva === "assujetti"
          ? input.tauxTvaStandardPercent
          : 0;
    const baseCents = Math.round(ligne.quantite * ligne.prixUnitaireHtCents);
    const tvaCents = Math.round((baseCents * taux) / 100);
    const entry = parTaux.get(taux) ?? { baseCents: 0, tvaCents: 0 };
    entry.baseCents += baseCents;
    entry.tvaCents += tvaCents;
    parTaux.set(taux, entry);
  }

  const lignesXml = input.lignes.map((ligne, i) => {
    const taux =
      ligne.tauxTvaPercent !== undefined
        ? ligne.tauxTvaPercent
        : input.regimeTva === "assujetti"
          ? input.tauxTvaStandardPercent
          : 0;
    const totalLigneCents = Math.round(ligne.quantite * ligne.prixUnitaireHtCents);
    return {
      "ram:AssociatedDocumentLineDocument": { "ram:LineID": String(i + 1) },
      "ram:SpecifiedTradeProduct": { "ram:Name": ligne.designation },
      "ram:SpecifiedLineTradeAgreement": {
        "ram:NetPriceProductTradePrice": { "ram:ChargeAmount": eur(ligne.prixUnitaireHtCents) },
      },
      "ram:SpecifiedLineTradeDelivery": {
        "ram:BilledQuantity": { "@_unitCode": "C62", "#text": String(ligne.quantite) },
      },
      "ram:SpecifiedLineTradeSettlement": {
        "ram:ApplicableTradeTax": {
          "ram:TypeCode": "VAT",
          "ram:CategoryCode": categorieTva(taux, exoneration),
          "ram:RateApplicablePercent": taux.toFixed(2),
        },
        "ram:SpecifiedTradeSettlementLineMonetarySummation": {
          "ram:LineTotalAmount": eur(totalLigneCents),
        },
      },
    };
  });

  const taxesXml = [...parTaux.entries()].map(([taux, montants]) => ({
    "ram:CalculatedAmount": eur(montants.tvaCents),
    "ram:TypeCode": "VAT",
    ...(taux === 0 && input.mentionExoneration !== undefined
      ? { "ram:ExemptionReason": input.mentionExoneration }
      : {}),
    "ram:BasisAmount": eur(montants.baseCents),
    "ram:CategoryCode": categorieTva(taux, exoneration),
    "ram:RateApplicablePercent": taux.toFixed(2),
  }));

  const doc = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    "rsm:CrossIndustryInvoice": {
      "@_xmlns:rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
      "@_xmlns:ram":
        "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
      "@_xmlns:udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
      "rsm:ExchangedDocumentContext": {
        "ram:GuidelineSpecifiedDocumentContextParameter": {
          "ram:ID": "urn:cen.eu:en16931:2017",
        },
      },
      "rsm:ExchangedDocument": {
        "ram:ID": input.numero,
        "ram:TypeCode": input.estAvoir ? "381" : "380",
        "ram:IssueDateTime": {
          "udt:DateTimeString": { "@_format": "102", "#text": dateCII(input.dateEmission) },
        },
      },
      "rsm:SupplyChainTradeTransaction": {
        "ram:IncludedSupplyChainTradeLineItem": lignesXml,
        "ram:ApplicableHeaderTradeAgreement": {
          ...(input.refClientCommande !== undefined
            ? { "ram:BuyerReference": input.refClientCommande }
            : {}),
          "ram:SellerTradeParty": partieVersXml(input.vendeur, "ram:SpecifiedTaxRegistration"),
          "ram:BuyerTradeParty": partieVersXml(input.acheteur, "ram:SpecifiedTaxRegistration"),
        },
        "ram:ApplicableHeaderTradeDelivery": {},
        "ram:ApplicableHeaderTradeSettlement": {
          "ram:InvoiceCurrencyCode": "EUR",
          ...(input.iban !== undefined
            ? {
                "ram:SpecifiedTradeSettlementPaymentMeans": {
                  "ram:TypeCode": "30",
                  "ram:PayeePartyCreditorFinancialAccount": { "ram:IBANID": input.iban },
                },
              }
            : {}),
          "ram:ApplicableTradeTax": taxesXml,
          ...(input.dateEcheance !== undefined
            ? {
                "ram:SpecifiedTradePaymentTerms": {
                  "ram:DueDateDateTime": {
                    "udt:DateTimeString": {
                      "@_format": "102",
                      "#text": dateCII(input.dateEcheance),
                    },
                  },
                },
              }
            : {}),
          "ram:SpecifiedTradeSettlementHeaderMonetarySummation": {
            "ram:LineTotalAmount": eur(totaux.totalHtCents),
            "ram:TaxBasisTotalAmount": eur(totaux.totalHtCents),
            "ram:TaxTotalAmount": { "@_currencyID": "EUR", "#text": eur(totaux.totalTvaCents) },
            "ram:GrandTotalAmount": eur(totaux.totalTtcCents),
            "ram:DuePayableAmount": eur(totaux.totalTtcCents),
          },
        },
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: true,
    suppressEmptyNode: false,
  });
  return builder.build(doc) as string;
}
