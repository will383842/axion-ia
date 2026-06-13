/**
 * Espace formateur — constantes de routes (2026-06-13).
 *
 * Locale forcée à `fr` : l'EN est désactivé (cf. AGENTS.md) et l'espace
 * formateur est un outil interne FR uniquement (noindex).
 */

const LOCALE = "fr";

/** Racine de l'espace formateur (tableau de bord). */
export const FORMATEUR_BASE_PATH = `/${LOCALE}/espace-formateur`;

/** Page de connexion (demande de lien magique). */
export const FORMATEUR_CONNEXION_PATH = `/${LOCALE}/espace-formateur/connexion`;

/** Segment de base sans locale (pour le matcher middleware). */
export const FORMATEUR_PATH_SEGMENT = "espace-formateur";

/**
 * Nom du cookie de session formateur. Défini ici (module pur, Edge-safe) pour
 * être importable à la fois par le middleware (proxy.ts) et par cookie.ts
 * (Node) sans tirer `next/headers` dans le bundle Edge.
 */
export const FORMATEUR_COOKIE_NAME = "formateur_session";

/**
 * Construit l'URL absolue de vérification d'un lien magique (pour l'e-mail).
 * Forme : `<site>/fr/espace-formateur/connexion/<token>`.
 */
export function buildFormateurMagicLinkUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  return `${base}/${LOCALE}/espace-formateur/connexion/${encodeURIComponent(token)}`;
}
