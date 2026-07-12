// SSOT identité légale — pages publiques (`/mentions-legales`,
// `/conditions-generales`) + cohérence avec les factures.
//
// POURQUOI : LCEN art. 1-1 (loi SREN n° 2024-449 du 21 mai 2024) impose
// d'afficher l'identité complète de l'éditeur (dénomination, forme juridique,
// capital, siège, RCS, SIREN, TVA, directeur de la publication, hébergeur).
// Plutôt que de figer ces valeurs dans le contenu, on les résout au runtime
// depuis le SiteSetting `legal_overrides` — LA MÊME clé que lit
// `legal-snapshot.ts` pour les factures. Will renseigne une seule fois ce JSON
// dans la console admin (`/settings` → clé `legal_overrides`) et :
//   • les mentions légales (ISR `revalidate=3600`) se mettent à jour sous 1 h ;
//   • les factures émises ensuite capturent les mêmes valeurs.
//
// D'ici la saisie réelle, des placeholders gracieux « communiqué sur demande »
// sont affichés — aucune mention ne reste vide ou cassée. Au build `stub.invalid`
// le reader Prisma renvoie `null` → on retombe sur les defaults.
//
// Compat factures : ce resolver accepte aussi les clés historiques de
// `legal-snapshot.ts` (`companyLegalForm`, `companyVatNumber`,
// `companyRegistrationNumber`) en repli, pour qu'un `legal_overrides` déjà
// partiellement rempli côté factures alimente aussi la page publique.

import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand";

/** Identité légale résolue, prête à l'affichage (jamais de champ `undefined`). */
export interface LegalIdentity {
  /** Dénomination sociale + suffixe juridique (ex. « Axion-IA SAS »). */
  legalName: string;
  /** Forme juridique en toutes lettres (LCEN art. 1-1). */
  legalForm: string;
  /** Capital social formaté (ex. « 1 000 € »), ou null si non communiqué. */
  capitalSocial: string | null;
  /** Adresse postale complète du siège social, ou null. */
  addressSiege: string | null;
  /** Ville du greffe d'immatriculation RCS (ex. « Paris »), ou null. */
  rcsVille: string | null;
  /** SIREN — 9 chiffres, ou null. */
  siren: string | null;
  /** SIRET du siège — 14 chiffres, ou null. */
  siret: string | null;
  /** N° de TVA intracommunautaire FR, ou null (régime/exonération à confirmer). */
  vatNumber: string | null;
  /** Email de contact public (toujours renseigné). */
  contactEmail: string;
  /** Téléphone de contact public, ou null. */
  contactPhone: string | null;
  /** Nom de la personne physique directrice de la publication (LCEN art. 1-1, 6°). */
  directorName: string;
  /** Qualité du directeur de la publication (ex. « Président »). */
  directorTitle: string;
  /**
   * Contact du responsable de la protection des données (RGPD art. 13/14, 37-39).
   * Adresse à laquelle une personne exerce ses droits (accès, effacement,
   * opposition). Toujours renseigné (défaut = contact public). Une PME n'a pas
   * toujours l'obligation de DÉSIGNER un DPO formel — mais doit fournir ce contact.
   */
  dpoContact: string;
  /**
   * Adresse du siège STRUCTURÉE (EN 16931 BG-5 — e-invoicing 2026/2027).
   * `addressSiege` (chaîne libre) reste le repli d'affichage ; ces champs
   * alimentent le XML Factur-X/CII et les PDF. Null tant que non renseignés.
   */
  addressStreet: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  /** Code pays ISO 3166-1 alpha-2 du siège (défaut FR). */
  addressCountryCode: string;
  /**
   * Coordonnées bancaires portées sur les factures (mode de règlement
   * virement — EN 16931 BG-17). Null tant que Will n'a pas renseigné l'IBAN
   * dans `legal_overrides` ; les PDF omettent alors le bloc RIB.
   */
  iban: string | null;
  bic: string | null;
  /** Titulaire du compte (défaut = dénomination sociale). */
  bankAccountHolder: string;
  /** Nom de la banque (optionnel, affichage). */
  bankName: string | null;
}

/**
 * Bloc RIB prêt pour les templates PDF des DEUX familles de factures
 * (`FacturePdf` qualiopi + `InvoiceDocument` booking). Null si IBAN absent.
 */
export interface RibIdentite {
  iban: string;
  bic: string;
  titulaire: string;
  banque?: string;
}

/**
 * Defaults SAS française. `legalName` dérive de la SSOT marque (`BRAND`).
 * `directorName`/`directorTitle` : arbitrage Will 2026-06-22 (Williams Jullin,
 * Président d'une SAS — nom complet exigé sur une page légale).
 */
export const LEGAL_IDENTITY_DEFAULTS: LegalIdentity = {
  legalName: BRAND.legalName,
  legalForm: "Société par actions simplifiée (SAS)",
  capitalSocial: null,
  addressSiege: null,
  rcsVille: null,
  siren: null,
  siret: null,
  vatNumber: null,
  contactEmail: "contact@axion-ia.com",
  contactPhone: null,
  directorName: "Williams Jullin",
  directorTitle: "Président",
  dpoContact: "contact@axion-ia.com",
  addressStreet: null,
  addressPostalCode: null,
  addressCity: null,
  addressCountryCode: "FR",
  iban: null,
  bic: null,
  bankAccountHolder: BRAND.legalName,
  bankName: null,
};

/** Normalise une valeur d'override en string non vide, sinon null. */
function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Lit `legal_overrides` (SiteSetting JSON) et le fusionne sur les defaults.
 * Tolère les clés historiques de `legal-snapshot.ts` en repli. Stub-aware :
 * au build `stub.invalid` le Proxy Prisma renvoie `null` → defaults.
 */
export async function resolveLegalIdentity(): Promise<LegalIdentity> {
  let overrides: Record<string, unknown> = {};
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: "legal_overrides" },
      select: { value: true },
    });
    if (row?.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      overrides = row.value as Record<string, unknown>;
    }
  } catch {
    overrides = {};
  }

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = str(overrides[k]);
      if (v !== null) return v;
    }
    return null;
  };

  return {
    legalName: pick("legalName") ?? LEGAL_IDENTITY_DEFAULTS.legalName,
    legalForm: pick("legalForm", "companyLegalForm") ?? LEGAL_IDENTITY_DEFAULTS.legalForm,
    capitalSocial: pick("capitalSocial"),
    addressSiege: pick("addressSiege", "siege", "adresseSiege"),
    rcsVille: pick("rcsVille"),
    siren: pick("siren"),
    siret: pick("siret"),
    vatNumber: pick("vatNumber", "companyVatNumber"),
    contactEmail: pick("contactEmail") ?? LEGAL_IDENTITY_DEFAULTS.contactEmail,
    contactPhone: pick("contactPhone", "phone"),
    directorName: pick("directorName") ?? LEGAL_IDENTITY_DEFAULTS.directorName,
    directorTitle: pick("directorTitle") ?? LEGAL_IDENTITY_DEFAULTS.directorTitle,
    dpoContact:
      pick("dpoContact", "dpoEmail", "privacyContact") ?? LEGAL_IDENTITY_DEFAULTS.dpoContact,
    addressStreet: pick("addressStreet"),
    addressPostalCode: pick("addressPostalCode"),
    addressCity: pick("addressCity"),
    addressCountryCode: pick("addressCountryCode") ?? LEGAL_IDENTITY_DEFAULTS.addressCountryCode,
    iban: pick("iban"),
    bic: pick("bic"),
    bankAccountHolder:
      pick("bankAccountHolder") ?? pick("legalName") ?? LEGAL_IDENTITY_DEFAULTS.bankAccountHolder,
    bankName: pick("bankName"),
  };
}

/**
 * Résout le bloc RIB des factures depuis `legal_overrides`. Retourne null tant
 * que l'IBAN n'est pas renseigné (les PDF omettent alors le bloc — cohérent
 * avec les CGV « IBAN communiqué sur la facture » dès qu'il est saisi).
 * Stub-aware via `resolveLegalIdentity` (defaults au build).
 */
export async function resolveRibFacture(): Promise<RibIdentite | null> {
  const id = await resolveLegalIdentity();
  if (!id.iban || !id.bic) return null;
  return {
    iban: id.iban,
    bic: id.bic,
    titulaire: id.bankAccountHolder,
    ...(id.bankName ? { banque: id.bankName } : {}),
  };
}

/** Assemble une phrase à partir de fragments, en ignorant les fragments vides. */
function sentence(...parts: Array<string | null | false | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}

/**
 * Construit les sections d'identité (« Éditeur » + « Directeur de la
 * publication ») à préfixer aux mentions légales. Pures, sans I/O : la page
 * appelle `resolveLegalIdentity()` puis passe le résultat ici. Toute valeur
 * absente est rendue « communiqué sur demande » plutôt que laissée vide.
 */
export function buildLegalIdentitySections(
  id: LegalIdentity,
  isFr: boolean,
): ReadonlyArray<{ title: string; body: string }> {
  const surDemande = isFr
    ? "communiqué sur demande à contact@axion-ia.com"
    : "available on request at contact@axion-ia.com";

  if (isFr) {
    const editeur = sentence(
      `Le site axion-ia.com est édité par ${id.legalName}, ${id.legalForm}`,
      id.capitalSocial ? `au capital de ${id.capitalSocial}` : null,
      "·",
      id.addressSiege ? `Siège social : ${id.addressSiege}.` : `Siège social : ${surDemande}.`,
      id.rcsVille
        ? `Immatriculée au RCS de ${id.rcsVille}${id.siren ? ` sous le numéro SIREN ${id.siren}` : ""}.`
        : id.siren
          ? `SIREN : ${id.siren}.`
          : `Immatriculation RCS et SIREN ${surDemande}.`,
      id.siret ? `SIRET (siège) : ${id.siret}.` : null,
      id.vatNumber
        ? `N° de TVA intracommunautaire : ${id.vatNumber}.`
        : `Numéro de TVA intracommunautaire ${surDemande}.`,
      `Contact : ${id.contactEmail}${id.contactPhone ? ` — Tél. : ${id.contactPhone}` : ""}.`,
    );
    const directeur = `Directeur de la publication : ${id.directorName}, ${id.directorTitle}. Pour toute question relative aux contenus du site : ${id.contactEmail}.`;
    return [
      { title: "Éditeur du site", body: editeur },
      { title: "Directeur de la publication", body: directeur },
    ];
  }

  const editeur = sentence(
    `The axion-ia.com website is published by ${id.legalName}, ${id.legalForm}`,
    id.capitalSocial ? `with share capital of ${id.capitalSocial}` : null,
    "·",
    id.addressSiege
      ? `Registered office: ${id.addressSiege}.`
      : `Registered office: ${surDemande}.`,
    id.rcsVille
      ? `Registered with the ${id.rcsVille} Trade and Companies Register${id.siren ? `, SIREN ${id.siren}` : ""}.`
      : id.siren
        ? `SIREN: ${id.siren}.`
        : `Registration details ${surDemande}.`,
    id.siret ? `SIRET (head office): ${id.siret}.` : null,
    id.vatNumber ? `Intra-EU VAT number: ${id.vatNumber}.` : `Intra-EU VAT number ${surDemande}.`,
    `Contact: ${id.contactEmail}${id.contactPhone ? ` — Phone: ${id.contactPhone}` : ""}.`,
  );
  const directeur = `Publication director: ${id.directorName}, ${id.directorTitle}. For any question regarding site content: ${id.contactEmail}.`;
  return [
    { title: "Publisher", body: editeur },
    { title: "Publication director", body: directeur },
  ];
}
