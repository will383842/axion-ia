// Legal snapshot helper — Sprint X.17 / Booking V1.
//
// Architecture TVA-agnostique FR vs EE (ADR 0015) : à l'émission d'une
// Invoice ou Quote, on capture un snapshot immuable des règles fiscales
// + clauses CGV applicables au moment de l'émission. Stocké dans le champ
// JSONB `Invoice.legalSnapshot` (cf. schema.prisma).
//
// Objectif : les factures déjà émises restent juridiquement valides avec les
// anciennes mentions. Pas de retro-activité fiscale.
//
// SOURCE :
//   - 04-PLAN-EXECUTION Sprint X.17
//   - ADR 0015 (architecture TVA agnostique)
//   - Agent 11 P0-1 à P0-7

import { prisma } from "@/lib/prisma";

export type FiscalRegime = "EE_OU" | "FR_SARL";

export interface LegalSnapshot {
  /** Version du schema snapshot (bump si rupture format). */
  version: 1;
  /** Régime fiscal en vigueur au moment de l'émission. */
  fiscalRegime: FiscalRegime;
  /** Mention TVA imprimée sur la facture (FR vs EE reverse-charge). */
  vatMention: string;
  /** Taux TVA en vigueur (0 si EE intra-UE, 20 si FR par défaut). */
  vatRate: number;
  /** Reverse-charge actif ? */
  vatReverseCharge: boolean;
  /** Loi applicable (« droit français »). */
  loiApplicable: string;
  /** Juridiction compétente (« tribunaux compétents en France »). */
  juridiction: string;
  /** Forme juridique (« [forme juridique à préciser] » / « SARL »). */
  companyLegalForm: string;
  /** Numéro d'enregistrement société (SIREN/RCS FR — ou registrikood EE pour snapshots legacy OÜ). */
  companyRegistrationNumber: string;
  /** Numéro TVA intracommunautaire (EE / FR). */
  companyVatNumber: string | null;
  /** Article force majeure applicable. */
  forceMajeureArticle: string;
  /** Snapshot ISO timestamp. */
  capturedAt: string;
}

/**
 * Snapshot legacy OÜ Estonie (rétrocompatibilité factures passées — NE PAS MODIFIER).
 * Utilisé uniquement pour les anciennes factures EE_OU. Non surchargeable.
 */
const DEFAULT_OU_SNAPSHOT: Omit<LegalSnapshot, "capturedAt"> = {
  version: 1,
  fiscalRegime: "EE_OU",
  vatRate: 0,
  vatReverseCharge: true,
  vatMention: "TVA non applicable — art. 196 directive 2006/112/CE (autoliquidation)",
  loiApplicable: "Droit estonien (Eesti)",
  juridiction: "Tribunaux compétents en Estonie (Harju Maakohus, Tallinn)",
  companyLegalForm: "OÜ",
  companyRegistrationNumber: "(communiqué sur demande)",
  companyVatNumber: null,
  forceMajeureArticle: "Võlaõigusseadus §103 (Estonie) — vis maior",
};

const DEFAULT_FR_SNAPSHOT: Omit<LegalSnapshot, "capturedAt"> = {
  version: 1,
  fiscalRegime: "FR_SARL",
  vatRate: 20,
  vatReverseCharge: false,
  vatMention: "TVA 20,00 %",
  loiApplicable: "Droit français",
  juridiction: "Tribunaux compétents en France",
  companyLegalForm: "[forme juridique à préciser]",
  companyRegistrationNumber: "(immatriculation communiquée sur demande)",
  companyVatNumber: null,
  forceMajeureArticle: "Code civil français, art. 1218",
};

/**
 * Lit le régime fiscal actuel depuis SiteSetting (clé `fiscal_regime`).
 * Défaut V1 : FR_SARL (Axion-IA France).
 */
async function readFiscalRegime(): Promise<FiscalRegime> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: "fiscal_regime" },
      select: { value: true },
    });
    const raw = row?.value as unknown;
    if (typeof raw === "string" && (raw === "EE_OU" || raw === "FR_SARL")) {
      return raw;
    }
    if (
      raw &&
      typeof raw === "object" &&
      "regime" in raw &&
      typeof (raw as { regime: unknown }).regime === "string"
    ) {
      const r = (raw as { regime: string }).regime;
      if (r === "EE_OU" || r === "FR_SARL") return r;
    }
    return "FR_SARL";
  } catch {
    return "FR_SARL";
  }
}

/**
 * Lit éventuels overrides admin depuis SiteSetting (clé `legal_overrides`).
 * Format : `{ companyRegistrationNumber?, companyVatNumber?, ... }`.
 */
async function readLegalOverrides(): Promise<Partial<Omit<LegalSnapshot, "capturedAt">>> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: "legal_overrides" },
      select: { value: true },
    });
    return (row?.value as unknown as Partial<LegalSnapshot>) ?? {};
  } catch {
    return {};
  }
}

/**
 * Capture le snapshot légal au moment T (now). À appeler avant
 * `Invoice.create({ legalSnapshot })` ou `Quote.create()`.
 */
export async function captureLegalSnapshot(): Promise<LegalSnapshot> {
  const regime = await readFiscalRegime();
  const base = regime === "FR_SARL" ? DEFAULT_FR_SNAPSHOT : DEFAULT_OU_SNAPSHOT;
  const overrides = await readLegalOverrides();
  return {
    ...base,
    ...overrides,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Helper synchrone pour tests + cas où on veut snapshot sans hit DB.
 */
export function captureLegalSnapshotSync(regime: FiscalRegime = "FR_SARL"): LegalSnapshot {
  const base = regime === "FR_SARL" ? DEFAULT_FR_SNAPSHOT : DEFAULT_OU_SNAPSHOT;
  return {
    ...base,
    capturedAt: new Date().toISOString(),
  };
}
