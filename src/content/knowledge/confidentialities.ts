/**
 * Knowledge Base — 4 niveaux confidentialité.
 * Orthogonal à `audience`. Détermine politique PII + envoi API tiers + masquage exports.
 */

import type { KbConfidentiality } from "../../../prisma/generated/client";

export const KB_CONFIDENTIALITIES: readonly KbConfidentiality[] = [
  "public",
  "internal",
  "confidential",
  "secret",
] as const;

export const KB_CONFIDENTIALITY_LABELS_FR: Record<KbConfidentiality, string> = {
  public: "Public",
  internal: "Interne",
  confidential: "Confidentiel",
  secret: "Secret",
};

export const KB_CONFIDENTIALITY_LABELS_EN: Record<KbConfidentiality, string> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  secret: "Secret",
};

/**
 * Refus dur : ces niveaux NE PEUVENT PAS être envoyés à une API tiers
 * (embeddings, LLM, RAG external). Filtre bloquant dans `embeddings.ts`
 * (Sprint KB-21). Cf. Agent 10 §10.5 + Agent 9 §9.10.
 */
export const NON_EXTERNAL_CONFIDENTIALITIES: readonly KbConfidentiality[] = [
  "confidential",
  "secret",
] as const;

export function isExternalApiAllowed(confidentiality: KbConfidentiality): boolean {
  return !NON_EXTERNAL_CONFIDENTIALITIES.includes(confidentiality);
}

export function getConfidentialityLabel(c: KbConfidentiality, locale: "fr" | "en"): string {
  return locale === "fr" ? KB_CONFIDENTIALITY_LABELS_FR[c] : KB_CONFIDENTIALITY_LABELS_EN[c];
}
