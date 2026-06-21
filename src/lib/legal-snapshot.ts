// Legal snapshot helper — Sprint X.17 / Booking V1.
//
// À l'émission d'une Invoice ou Quote, on capture un snapshot IMMUABLE des
// règles fiscales + clauses CGV applicables au moment de l'émission, stocké
// dans le champ JSONB `Invoice.legalSnapshot` (cf. schema.prisma). Les factures
// déjà émises restent juridiquement valides avec leurs mentions d'origine.
//
// Axion-IA est une **SAS française** : régime France uniquement (TVA 20 %, droit
// français). Les vrais identifiants (SIREN, n° TVA FR…) sont fournis via le
// SiteSetting `legal_overrides` (readLegalOverrides) dès qu'ils sont connus ;
// d'ici là, des placeholders « communiqué sur demande » sont utilisés.

import { prisma } from "@/lib/prisma";

/** Régime fiscal — SAS française uniquement. */
export type FiscalRegime = "FR_SARL";

export interface LegalSnapshot {
  /** Version du schema snapshot (bump si rupture format). */
  version: 1;
  /** Régime fiscal en vigueur au moment de l'émission. */
  fiscalRegime: FiscalRegime;
  /** Mention TVA imprimée sur la facture. */
  vatMention: string;
  /** Taux TVA en vigueur (20 % France par défaut). */
  vatRate: number;
  /** Reverse-charge actif (autoliquidation B2B intra-UE). */
  vatReverseCharge: boolean;
  /** Loi applicable (« droit français »). */
  loiApplicable: string;
  /** Juridiction compétente (« tribunaux compétents en France »). */
  juridiction: string;
  /** Forme juridique (« SAS »). */
  companyLegalForm: string;
  /** Numéro d'enregistrement société (SIREN/RCS FR). */
  companyRegistrationNumber: string;
  /** Numéro TVA intracommunautaire FR. */
  companyVatNumber: string | null;
  /** Article force majeure applicable. */
  forceMajeureArticle: string;
  /** Snapshot ISO timestamp. */
  capturedAt: string;
}

/** Snapshot par défaut SAS française. */
const DEFAULT_FR_SNAPSHOT: Omit<LegalSnapshot, "capturedAt"> = {
  version: 1,
  fiscalRegime: "FR_SARL",
  vatRate: 20,
  vatReverseCharge: false,
  vatMention: "TVA 20,00 %",
  loiApplicable: "Droit français",
  juridiction: "Tribunaux compétents en France",
  companyLegalForm: "SAS",
  companyRegistrationNumber: "(immatriculation communiquée sur demande)",
  companyVatNumber: null,
  forceMajeureArticle: "Code civil français, art. 1218",
};

/**
 * Lit les overrides légaux admin depuis SiteSetting (clé `legal_overrides`).
 * Format : `{ companyRegistrationNumber?, companyVatNumber?, ... }`. Permet de
 * renseigner les vrais SIREN / n° TVA FR sans redéploiement.
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
  const overrides = await readLegalOverrides();
  return {
    ...DEFAULT_FR_SNAPSHOT,
    ...overrides,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Helper synchrone pour tests + cas où on veut un snapshot sans hit DB.
 */
export function captureLegalSnapshotSync(): LegalSnapshot {
  return {
    ...DEFAULT_FR_SNAPSHOT,
    capturedAt: new Date().toISOString(),
  };
}
