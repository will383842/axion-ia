// SSOT — Catégorie juridique INSEE → type d'organisation (T1/T3).
//
// Module Prospection. Dérive `typeOrganisation` (privé/public/collectivité/…) à
// partir de la catégorie juridique INSEE (`categorieJuridiqueUniteLegale`, code
// 2-4 chiffres). Permet de filtrer/segmenter le public (EDF, mairies, EPIC…).
// Raisonnement sur le préfixe 2 chiffres (niveau I de la nomenclature). Repli
// `privee` (la très grande majorité des unités légales). Pur.

import type { TypeOrganisation } from "./enums";

// Préfixe 2 chiffres de la catégorie juridique → type d'organisation.
const PREFIX_TO_TYPE: Record<string, TypeOrganisation> = {
  // 1x — entrepreneur individuel → privé
  "10": "privee",
  // 2x — (groupements de droit privé non dotés de personnalité morale) → privé
  "21": "privee",
  // 3x — personne morale de droit étranger → privé
  "31": "privee",
  "32": "privee",
  // 41 — établissement public ou régie à caractère industriel ou commercial → EPIC
  "41": "epic",
  // 5x — sociétés commerciales (SA/SARL/SAS/SNC…) → privé
  "51": "privee",
  "52": "privee",
  "53": "privee",
  "54": "privee",
  "55": "privee",
  "56": "privee",
  "57": "privee",
  "58": "privee",
  // 6x — autres personnes morales de droit privé (GIE, coopératives…) → privé
  "61": "privee",
  "62": "privee",
  "63": "privee",
  "64": "privee",
  "65": "privee",
  "69": "privee",
  // 7x — personnes morales de droit public
  "71": "publique", // administration de l'État
  "72": "collectivite", // collectivités territoriales
  "73": "publique", // établissements publics administratifs
  "74": "publique", // autres personnes morales de droit public
  // 8x — organismes de sécurité sociale / mutualité → parapublique
  "81": "parapublique",
  "82": "parapublique",
  // 9x — groupements de droit privé
  "91": "association", // syndicats de propriétaires / groupements
  "92": "association", // associations loi 1901
  "93": "association", // fondations
};

/**
 * Type d'organisation depuis la catégorie juridique INSEE. Repli `privee`
 * (unité légale privée par défaut). Ne jette jamais.
 */
export function typeOrganisationFromNatureJuridique(
  categorieJuridique: string | null | undefined,
): TypeOrganisation {
  if (!categorieJuridique) return "privee";
  const digits = categorieJuridique.replace(/[^0-9]/g, "");
  if (digits.length < 2) return "privee";
  return PREFIX_TO_TYPE[digits.slice(0, 2)] ?? "privee";
}

/** Vrai si l'organisation est publique/parapublique/collectivité/EPIC. */
export function isPublicOrganisation(type: TypeOrganisation): boolean {
  return (
    type === "publique" || type === "parapublique" || type === "collectivite" || type === "epic"
  );
}
