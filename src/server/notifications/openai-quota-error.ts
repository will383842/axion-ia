/**
 * Classifieur unique « crédit OpenAI épuisé » (SSOT).
 *
 * Extrait de `openai.ts` (mapOpenAiError) pour être partagé sans tirer le SDK :
 * le texte (via le SDK) et les embeddings (via fetch) reconnaissent ainsi
 * exactement la même famille d'erreurs. Les motifs de message restent
 * volontairement étroits : un vrai rate-limit transitoire ne doit PAS passer
 * pour un solde nul.
 */

export interface OpenAiErrorFields {
  readonly type?: string | null | undefined;
  readonly code?: string | null | undefined;
  readonly message?: string | null | undefined;
}

const QUOTA_MESSAGE_RE =
  /insufficient[_-]quota|exceeded your current quota|check your plan and billing|no credits remaining|credit[_\s-]balance/i;

export function isOpenAiQuotaError(err: OpenAiErrorFields): boolean {
  return (
    err.type === "insufficient_quota" ||
    err.code === "insufficient_quota" ||
    err.code === "credit_balance_exhausted" ||
    err.code === "billing_hard_limit_reached" ||
    err.code === "billing_not_active" ||
    QUOTA_MESSAGE_RE.test(err.message ?? "")
  );
}
