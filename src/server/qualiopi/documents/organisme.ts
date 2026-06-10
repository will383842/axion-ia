/**
 * Qualiopi — Identité organisme de formation.
 *
 * Lit les paramètres depuis `SiteSetting` (cat. `qualiopi`) via
 * `getQualiopiConfig`. Défauts vides si non renseignés.
 *
 * Exporté pour les templates PDF (convention, attestation, certificat, etc.)
 * qui en dépendent — NE PAS duplication ces lectures ailleurs.
 */

import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

/** Identité complète de l'organisme de formation. */
export interface OrganismeIdentite {
  raisonSociale: string;
  nda: string;
  qualiopi: string;
  siret: string;
  adresseSiege: string;
  adresseExercice: string;
  /** Email/téléphone de contact GÉNÉRAL de l'OF (convention, facture, réclamations). */
  email: string;
  telephone: string;
  site: string;
  /** Contact du référent handicap (sections handicap uniquement). Optionnel. */
  referentHandicapEmail?: string;
  /** Contact DPO / RGPD (exercice des droits). Fallback = email général. Optionnel. */
  dpoEmail?: string;
}

/**
 * Lit l'identité de l'organisme depuis la config Qualiopi.
 * Défauts vides ("") si une clé n'est pas encore renseignée.
 * Stub-aware : en build stub.invalid, `getQualiopiConfig` retourne les défauts.
 */
export async function getOrganismeIdentite(): Promise<OrganismeIdentite> {
  const [
    raisonSociale,
    nda,
    qualiopi,
    siret,
    adresseSiege,
    adresseExercice,
    email,
    telephone,
    site,
    referentHandicapEmail,
    dpoEmail,
  ] = await Promise.all([
    getQualiopiConfig("raison_sociale"),
    getQualiopiConfig("nda_numero"),
    getQualiopiConfig("qualiopi_numero"),
    getQualiopiConfig("siret"),
    getQualiopiConfig("adresse_siege"),
    getQualiopiConfig("adresse_exercice"),
    // Contact GÉNÉRAL de l'OF (plus le contact handicap — corrigé audit 2026-06-10).
    getQualiopiConfig("email_organisme"),
    getQualiopiConfig("telephone_organisme"),
    getQualiopiConfig("site_url"),
    getQualiopiConfig("referent_handicap_email"),
    getQualiopiConfig("dpo_contact_email"),
  ]);

  const emailOrganisme = email || "";

  return {
    raisonSociale: raisonSociale || "",
    nda: nda || "",
    qualiopi: qualiopi || "",
    siret: siret || "",
    adresseSiege: adresseSiege || "",
    adresseExercice: adresseExercice || "",
    email: emailOrganisme,
    telephone: telephone || "",
    site: site || "",
    referentHandicapEmail: referentHandicapEmail || "",
    // DPO non renseigné → on retombe sur le contact général de l'OF (jamais le handicap).
    dpoEmail: dpoEmail || emailOrganisme,
  };
}
