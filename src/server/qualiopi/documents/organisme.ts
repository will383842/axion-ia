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
  email: string;
  telephone: string;
  site: string;
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
  ] = await Promise.all([
    getQualiopiConfig("raison_sociale"),
    getQualiopiConfig("nda_numero"),
    getQualiopiConfig("qualiopi_numero"),
    getQualiopiConfig("siret"),
    getQualiopiConfig("adresse_siege"),
    getQualiopiConfig("adresse_exercice"),
    getQualiopiConfig("referent_handicap_email"),
    getQualiopiConfig("referent_handicap_telephone"),
    getQualiopiConfig("site_url"),
  ]);

  return {
    raisonSociale: raisonSociale || "",
    nda: nda || "",
    qualiopi: qualiopi || "",
    siret: siret || "",
    adresseSiege: adresseSiege || "",
    adresseExercice: adresseExercice || "",
    email: email || "",
    telephone: telephone || "",
    site: site || "",
  };
}
