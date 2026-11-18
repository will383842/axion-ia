/**
 * En-têtes de la page du questionnaire de pré-audit (2026-10-24) — module PUR.
 *
 * Le HTML de Will contient du JavaScript qui tourne chez le prospect, sur l'origine du site :
 * il est donc servi en BAC À SABLE (`sandbox` sans `allow-same-origin` : origine opaque, aucun
 * cookie ni stockage du site, aucun accès à la console). Il ne peut parler qu'à l'adresse de
 * ses propres réponses (`connect-src 'self'` = le POST du questionnaire ; la route répond en
 * CORS à l'origine opaque `null`). Mêmes valeurs posées dans `next.config.ts` (qui l'emporte).
 */

export const CSP_PAGE_PREAUDIT = [
  "sandbox allow-scripts allow-forms",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "connect-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

export const ENTETES_PAGE_PREAUDIT = {
  // `no-transform` : Cloudflare n'injecte plus son script dans le HTML (la CSP du bac à sable le
  // bloquait, d'où une erreur dans la console du navigateur du prospect).
  "Cache-Control": "no-store, no-transform",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": CSP_PAGE_PREAUDIT,
} as const;

/** CORS du POST : l'origine d'un document en bac à sable est la chaîne « null ». */
export const ENTETES_CORS_PREAUDIT = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
} as const;

/** CORS du brouillon (même origine `null`) : relu (GET), enregistré (POST), retiré (DELETE). */
export const ENTETES_CORS_BROUILLON = {
  ...ENTETES_CORS_PREAUDIT,
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
} as const;
