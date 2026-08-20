/**
 * Qualiopi — Identité PUBLIQUE (badge, bandeau, mentions légales).
 *
 * Construit sur `getOrganismeIdentite` (SSOT identité OF, déjà utilisé par les
 * PDF) + le drapeau de divulgation `isQualiopiPublicDisclosureEnabled`. NE
 * duplique PAS les lectures de config.
 *
 * Contrat de sûreté (Phase A) :
 *  - Tant que `OF_PUBLIC_DISCLOSURE_ENABLED !== "true"` → renvoie `null`
 *    IMMÉDIATEMENT, sans AUCUN appel DB (coût nul sur les pages publiques).
 *  - Même en Phase B, tant que `QUALIOPI_CERTIFICATION_OBTENUE !== "true"` →
 *    `null` : on ne revendique JAMAIS « certifié Qualiopi » sans certification
 *    (ce serait une tromperie + une non-conformité d'usage de la marque).
 *    Découplé le 2026-07-25 (audit F13) : la visibilité des pages ne vaut plus
 *    attestation de certification.
 *
 * Build `stub.invalid` : `getQualiopiConfig` renvoie les défauts (vides) → le
 * n° de certificat est vide → `null`. Les surfaces publiques se peuplent au
 * runtime via l'ISR (real DB) une fois la Phase B activée.
 *
 * `cache()` (React) déduplique l'appel à l'échelle d'un rendu : le bandeau
 * (layout) + le badge (footer) + la section mentions légales partagent une
 * seule lecture par requête.
 */

import { cache } from "react";
import {
  isQualiopiPublicDisclosureEnabled,
  isQualiopiCertificationObtenue,
} from "@/server/qualiopi/config/flag";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { CATEGORIES_CERTIFIEES_REPLI } from "@/server/qualiopi/config/registry";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";

/**
 * N° de déclaration d'activité exposable publiquement, ou `""`.
 *
 * 🔴 2026-08-17. Le NDA n'avait qu'UN chemin vers une surface publique :
 * `computeQualiopiPublicIdentity()`, qui rend `null` tant que la certification
 * Qualiopi n'est pas obtenue. Le numéro était donc enfermé dans le même bloc que
 * la revendication Qualiopi. Le jour où le récépissé DREETS est arrivé (17 août
 * 2026), le site n'en aurait rien affiché — alors que la certification, elle,
 * doit rester éteinte encore longtemps.
 *
 * Ce sont deux choses distinctes, et c'est précisément la distinction que le
 * découplage F13 (2026-07-25) avait déjà faite au niveau des DRAPEAUX sans la
 * faire au niveau du RENDU :
 *   - l'enregistrement DREETS est un fait administratif, opposable, que
 *     l'art. L.6352-12 impose même de mentionner dès qu'on en fait état ;
 *   - la certification Qualiopi est une attestation de qualité délivrée après
 *     audit, qu'on ne revendique jamais sans certificat.
 *
 * Cette fonction ne dépend donc PAS de `isQualiopiCertificationObtenue()`. Elle
 * reste gatée sur la Phase A/B, comme toute surface publique de l'OF : hors
 * Phase B, aucune activité d'organisme n'est présentée, un numéro de déclaration
 * n'y aurait rien à éclairer — et le retour anticipé garantit zéro accès DB.
 *
 * Chaîne vide = « pas de numéro » (config non renseignée, ou build stub avant
 * que le défaut de registre n'existe). Les appelants OMETTENT alors la mention.
 */
export async function computeNdaPublic(): Promise<string> {
  if (!isQualiopiPublicDisclosureEnabled()) return "";
  const nda = await getQualiopiConfig("nda_numero");
  return nda.trim();
}

/** Version mémoïsée par requête — cf. `computeNdaPublic`. */
export const getNdaPublic = cache(computeNdaPublic);

/** Identité Qualiopi exposable côté public (Phase B uniquement). */
export interface QualiopiPublicIdentity {
  raisonSociale: string;
  /** N° de déclaration d'activité (NDA). */
  nda: string;
  /** N° du certificat Qualiopi (garanti non vide). */
  qualiopiNumero: string;
  /** Organisme certificateur (COFRAC). Peut être vide. */
  qualiopiOrganisme: string;
  /** Date de délivrance (ISO YYYY-MM-DD). Peut être vide. */
  qualiopiDateObtention: string;
  /** Date d'expiration (ISO YYYY-MM-DD). Peut être vide. */
  qualiopiValidite: string;
  /** Catégorie(s) d'actions certifiées (mention obligatoire). Toujours renseignée. */
  categoriesCertifiees: string;
  /** Chemin du logo officiel Qualiopi, ou "" tant qu'il n'est pas déposé. */
  logoPath: string;
  siret: string;
  adresseSiege: string;
}

/**
 * Implémentation NON mémoïsée (exportée pour les tests — la mémoïsation `cache()`
 * par requête rendrait un test multi-scénarios instable). En production, toujours
 * utiliser `getQualiopiPublicIdentity` ci-dessous.
 */
export async function computeQualiopiPublicIdentity(): Promise<QualiopiPublicIdentity | null> {
  // Phase A : aucune divulgation, aucun accès DB.
  if (!isQualiopiPublicDisclosureEnabled()) return null;

  // 🚨 Garde de certification (audit 2026-07-25, F13). Cette fonction alimente
  // le badge, le bandeau et la section « mentions légales » — c'est-à-dire les
  // surfaces qui AFFIRMENT la certification. Elles exigent que le certificat
  // soit réellement obtenu, ce que la visibilité des pages ne prouve pas.
  //
  // Le contrat annoncé en tête de ce fichier (« on ne revendique JAMAIS certifié
  // Qualiopi sans certificat ») avait été retiré de l'implémentation : la
  // Phase B était considérée comme valant attestation. Elle ne l'est plus.
  if (!isQualiopiCertificationObtenue()) return null;

  const [org, qualiopiOrganisme, qualiopiDateObtention, qualiopiValidite, categories, logoPath] =
    await Promise.all([
      getOrganismeIdentite(),
      getQualiopiConfig("qualiopi_organisme"),
      getQualiopiConfig("qualiopi_date_obtention"),
      getQualiopiConfig("qualiopi_validite"),
      getQualiopiConfig("qualiopi_categories_certifiees"),
      getQualiopiConfig("qualiopi_logo_path"),
    ]);

  // Décision Will : le n° de certificat n'est JAMAIS affiché publiquement → il
  // est retiré du rendu des composants (badge/bandeau/FAQ) ET n'est plus une
  // condition d'affichage ici. Le flag Phase B EST l'attestation délibérée de
  // divulgation (« NDA + Qualiopi obtenus », cf. flag.ts) : dès la Phase B, on
  // affiche la version TEXTE conforme (« Organisme certifié Qualiopi » +
  // catégorie), sans logo ni numéro. Le n° et le logo restent des enrichissements
  // OPTIONNELS (renseignés en admin), le logo débloquant le visuel du badge.
  // (Pas de garde numéro ici : la garde Phase A ci-dessus suffit.)

  return {
    raisonSociale: org.raisonSociale,
    nda: org.nda,
    qualiopiNumero: org.qualiopi,
    qualiopiOrganisme,
    qualiopiDateObtention,
    qualiopiValidite,
    // 🔴 2026-08-20 — le littéral vivait AUSSI comme défaut du registre. Il n'a
    // plus qu'un domicile (`CATEGORIES_CERTIFIEES_REPLI`), et le registre rend
    // désormais `""` : c'est ce vide qui permet à l'alerte console de rougir
    // tant que personne n'a lu la catégorie sur le certificat.
    //
    // On garde un repli d'affichage plutôt qu'un trou : la mention « au titre de
    // la ou des catégories d'actions suivantes » est OBLIGATOIRE quand on
    // affiche la marque. Retirer une mention obligatoire pour punir une
    // configuration vide serait pire que le défaut qu'on corrige.
    categoriesCertifiees: categories.trim() || CATEGORIES_CERTIFIEES_REPLI,
    logoPath,
    siret: org.siret,
    adresseSiege: org.adresseSiege,
  };
}

/**
 * Renvoie l'identité Qualiopi à afficher publiquement, ou `null` si la Phase B
 * n'est pas active / le certificat n'est pas renseigné. Mémoïsé par requête
 * (`cache`) : bandeau + badge + section mentions légales partagent une lecture.
 */
export const getQualiopiPublicIdentity = cache(computeQualiopiPublicIdentity);
