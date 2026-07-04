// SSOT — Barèmes de score (leadScore 0-100) + dérivation de la contactabilité (T1).
//
// Module Prospection. Poids par défaut ici, surchargables via `SiteSetting`
// catégorie `prospection` (05-DATA-MODEL §5.10, 03-SPEC §3). Aucune décision
// automatisée à effet juridique (RGPD art. 22) : le score n'est qu'une aide au tri.
// `exploitable` = ≥ 1 email valide MX-OK ; téléphone = bonus (07-DECISIONS Q2).
// Pur, déterministe.

import type { Contactabilite, ContactabiliteNuance } from "./enums";

/** Poids (points) de chaque signal. La somme des maxima atteint 100. */
export interface ScoringWeights {
  emailVerified: number; // email MX-OK présent
  emailUnverified: number; // email présent mais non vérifié (exclusif de emailVerified)
  phoneValid: number; // téléphone E.164 valide
  nominative: number; // au moins un contact nominatif (rattaché à une personne)
  dirigeant: number; // au moins un dirigeant/responsable capturé
  freshness: number; // donnée dans la fenêtre de fraîcheur
  officialSource: number; // donnée issue d'une source officielle
  targetMatch: number; // correspond à la cible de campagne (secteur/taille/dép)
  etablissementActif: number; // établissement actif (non cessé)
}

/** Poids par défaut (max cumulé = 100). */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  emailVerified: 28,
  emailUnverified: 10,
  phoneValid: 12,
  nominative: 14,
  dirigeant: 12,
  freshness: 10,
  officialSource: 8,
  targetMatch: 8,
  etablissementActif: 8,
};

/** Signaux d'une entreprise servant au score et à la contactabilité. */
export interface LeadSignals {
  hasEmailVerified: boolean; // au moins un email verifStatus=mx_ok
  hasEmail: boolean; // au moins un email (vérifié ou non)
  hasPhoneValid: boolean; // au moins un téléphone e164_ok
  hasNominativeContact: boolean; // au moins un contact rattaché à une personne
  hasDirigeant: boolean;
  isFresh: boolean;
  isOfficialSource: boolean;
  matchesTarget: boolean;
  etablissementActif: boolean;
}

function clamp0100(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

/** leadScore 0-100 (poids surchargables). Composante email = vérifié XOR non-vérifié. */
export function computeLeadScore(
  s: LeadSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  let score = 0;
  if (s.hasEmailVerified) score += weights.emailVerified;
  else if (s.hasEmail) score += weights.emailUnverified;
  if (s.hasPhoneValid) score += weights.phoneValid;
  if (s.hasNominativeContact) score += weights.nominative;
  if (s.hasDirigeant) score += weights.dirigeant;
  if (s.isFresh) score += weights.freshness;
  if (s.isOfficialSource) score += weights.officialSource;
  if (s.matchesTarget) score += weights.targetMatch;
  if (s.etablissementActif) score += weights.etablissementActif;
  return clamp0100(score);
}

/**
 * Dérive la contactabilité (07-DECISIONS Q2) :
 *  - `exploitable`      = ≥ 1 email valide (MX-OK). Téléphone = bonus, pas condition.
 *  - `partiel`          = un contact non vérifié (email sans MX-OK) OU téléphone seul.
 *  - `non_contactable`  = aucun email ni téléphone.
 * Nuance : `exploitable_nominatif` si un email nominatif vérifié existe.
 */
export function deriveContactabilite(s: {
  hasEmailVerified: boolean;
  hasEmail: boolean;
  hasPhoneValid: boolean;
  hasNominativeVerifiedEmail: boolean;
}): { contactabilite: Contactabilite; nuance: ContactabiliteNuance } {
  if (s.hasEmailVerified) {
    return {
      contactabilite: "exploitable",
      nuance: s.hasNominativeVerifiedEmail ? "exploitable_nominatif" : "exploitable_generique",
    };
  }
  if (s.hasEmail || s.hasPhoneValid) {
    return { contactabilite: "partiel", nuance: "aucune" };
  }
  return { contactabilite: "non_contactable", nuance: "aucune" };
}
