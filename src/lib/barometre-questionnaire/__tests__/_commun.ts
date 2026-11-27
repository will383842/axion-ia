// Aides de test partagées (non collectées comme spec : pas de suffixe .spec).
import { CONSENT_VERSION } from "../constantes";

export const HASH_OK = "a".repeat(64);

export const TECHNIQUES = {
  consentement: true,
  consentVersion: CONSENT_VERSION,
  codeRetraitHash: HASH_OK,
  turnstileToken: "jeton",
  startedAt: 0,
} as const;

/** Une réponse complète d'une entreprise qui utilise l'IA. */
export const UTILISATEUR = {
  q1: "5-9",
  q2: "commerce",
  q3: "bretagne",
  q4: "oui-regulierement",
  q5: ["assistant-grand-public"],
  q6: "gratuites",
  q7: ["rediger", "traduction"],
  q8: "6-12-mois",
  q9: ["gain-de-temps"],
  q10: ["temps", "cout"],
  q11: "non",
  q12: "oui-moi",
  q13: "oui",
  q14: ["decouvrir"],
  ...TECHNIQUES,
} as const;

/** Une réponse complète d'une entreprise qui n'utilise pas l'IA (q5 à q9 absents). */
export const NON_UTILISATEUR = {
  q1: "1-4",
  q2: "numerique",
  q3: "outre-mer",
  q4: "non-pas-prevu",
  q10: ["aucun-frein"],
  q11: "ne-sais-pas",
  q12: "non",
  q13: "non",
  ...TECHNIQUES,
} as const;
