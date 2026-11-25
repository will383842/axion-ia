/**
 * Drapeau et preuve du fact-check par Claude (PR 5) : module LÉGER (aucune dépendance base,
 * Redis ou BullMQ), importé par les workers de publication. Voir `fact-check-claude.ts`.
 */

import { lireTypesClaude } from "../providers/types-claude";

export type EnvFactCheck = Readonly<Record<string, string | undefined>>;

export function factCheckClaudeActif(
  contentType: string,
  env: EnvFactCheck = process.env,
): boolean {
  return (
    env["CONTENT_GEN_FACTCHECK_CLAUDE"] === "true" &&
    env["CONTENT_GEN_BLOG_CLAUDE"] === "true" &&
    lireTypesClaude(env["CONTENT_GEN_CLAUDE_TYPES"], () => undefined).has(contentType)
  );
}

/** Marqueur écrit dans `outputJsonRaw` quand le fact-check Claude a RÉELLEMENT abouti sans réserve. */
export const MARQUEUR_FACT_CHECK_CLAUDE = "factCheckClaudePasse";

/** Vrai si la sortie persistée porte la preuve d'un fact-check Claude abouti. */
export function factCheckClaudePasse(output: unknown): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as Record<string, unknown>)[MARQUEUR_FACT_CHECK_CLAUDE] === true
  );
}
