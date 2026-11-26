/**
 * Marqueur des jobs d'ESSAI (script `essai-blog-claude-brouillon`) : brouillons lus
 * par le dirigeant, jamais repris, jamais régénérés, jamais publiés.
 * Module PUR (aucune base) : partagé par la reprise, le worker et le script.
 */
export const PREFIXE_CLE_ESSAI = "essai-claude-";

export function estJobEssaiClaude(job: {
  readonly idempotencyKey?: string | null;
  readonly inputPayload?: unknown;
}): boolean {
  if (typeof job.idempotencyKey === "string" && job.idempotencyKey.startsWith(PREFIXE_CLE_ESSAI)) {
    return true;
  }
  const p = job.inputPayload;
  return !!p && typeof p === "object" && (p as Record<string, unknown>)["essaiClaude"] === true;
}
