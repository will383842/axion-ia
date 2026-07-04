/**
 * Prospection — Identité du responsable de traitement (RGPD).
 *
 * SOURCE UNIQUE : `resolveLegalIdentity()` (SiteSetting `legal_overrides`, édité
 * dans la console `/settings`, partagé avec les mentions légales + factures) —
 * PAS de duplication dans la config prospection. Seule la gouvernance AIPD
 * (qui/quand a validé) est propre au module.
 *
 * `productionReady` = l'identité minimale légalement requise pour une collecte
 * en production est renseignée. Sert de garde-fou UI (pas de blocage build/test).
 */

import { resolveLegalIdentity } from "@/lib/legal-identity";
import { getProspectionConfig } from "@/server/prospection/config/site-settings";

export interface ProspectionControllerIdentity {
  legalName: string;
  siren: string | null;
  siret: string | null;
  addressSiege: string | null;
  contactEmail: string;
  dpoContact: string;
  aipdValidatedBy: string;
  aipdValidatedAt: string;
  /** Champs légaux encore manquants pour une collecte prod conforme. */
  missing: string[];
  productionReady: boolean;
}

export async function getProspectionControllerIdentity(): Promise<ProspectionControllerIdentity> {
  const [id, gov] = await Promise.all([
    resolveLegalIdentity(),
    getProspectionConfig("aipdGovernance"),
  ]);

  const missing: string[] = [];
  if (!id.siren) missing.push("SIREN (Kbis)");
  if (!id.addressSiege) missing.push("adresse du siège");
  if (!gov.aipdValidatedBy) missing.push("validation AIPD (qui)");

  return {
    legalName: id.legalName,
    siren: id.siren,
    siret: id.siret,
    addressSiege: id.addressSiege,
    contactEmail: id.contactEmail,
    dpoContact: id.dpoContact,
    aipdValidatedBy: gov.aipdValidatedBy,
    aipdValidatedAt: gov.aipdValidatedAt,
    missing,
    productionReady: missing.length === 0,
  };
}
