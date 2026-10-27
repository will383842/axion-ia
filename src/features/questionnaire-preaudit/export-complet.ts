/**
 * Export COMPLET des réponses d'un questionnaire avant audit (2026-10-27) — lecture seule.
 * Interrupteur `QUESTIONNAIRE_EXPORT_COMPLET_ENABLED` : ABSENT = ÉTEINT, seule la valeur exacte
 * "true" l'allume.
 */

type Env = Readonly<Record<string, string | undefined>>;

export const exportCompletActif = (env: Env = process.env): boolean =>
  env["QUESTIONNAIRE_EXPORT_COMPLET_ENABLED"] === "true";
