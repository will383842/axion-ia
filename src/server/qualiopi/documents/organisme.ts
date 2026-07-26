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
import { resolveLegalIdentity } from "@/lib/legal-identity";

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
  /**
   * Identité COMMERCIALE — mentions obligatoires des factures.
   *
   * 🔴 Audit certification 2026-07-26 (F26). La facture ne recevait que
   * `raisonSociale`, `siret`, `nda` et les adresses. Il manquait quatre mentions
   * que la loi impose à toute société commerciale :
   *   - forme juridique, capital social, RCS + ville  → art. R123-238 C. com. ;
   *   - n° de TVA intracommunautaire dès 150 €        → art. 242 nonies A CGI.
   *
   * La donnée existait déjà dans `LegalIdentity` (`src/lib/legal-identity.ts`),
   * qui alimente les mentions légales publiques : deux structures coexistaient
   * sans se parler, et la facture utilisait la plus pauvre. On lit désormais la
   * MÊME source (`legal_overrides`) — une seule saisie, aucune divergence
   * possible entre le site et les pièces comptables.
   *
   * `null` tant que Will n'a pas renseigné le champ : les blocs correspondants
   * sont alors omis du PDF plutôt qu'affichés vides.
   *
   * FACULTATIFS au sens du type, et c'est délibéré : seule la facture porte ces
   * mentions. Les convocations, attestations et supports n'en ont pas l'usage et
   * ne doivent pas être forcés de les fournir — les rendre obligatoires
   * n'ajouterait aucune garantie, juste un champ `null` recopié partout.
   */
  formeJuridique?: string | null;
  capitalSocial?: string | null;
  rcsVille?: string | null;
  siren?: string | null;
  tvaIntracom?: string | null;
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

  // F26 — identité commerciale lue depuis `legal_overrides`, la MÊME clé que les
  // mentions légales publiques. Enveloppée : une facture ne doit pas échouer
  // parce que le bloc légal est absent, elle doit sortir avec ce qu'on a — les
  // champs manquants sont simplement omis du PDF.
  let legal: Awaited<ReturnType<typeof resolveLegalIdentity>> | null = null;
  try {
    legal = await resolveLegalIdentity();
  } catch {
    legal = null;
  }

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
    formeJuridique: legal?.legalForm ?? null,
    capitalSocial: legal?.capitalSocial ?? null,
    rcsVille: legal?.rcsVille ?? null,
    siren: legal?.siren ?? null,
    tvaIntracom: legal?.vatNumber ?? null,
  };
}
