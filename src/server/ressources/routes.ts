/**
 * Espace ressources — constantes de routes (2026-06-13).
 *
 * Portail passwordless où commerciaux + formateurs consultent / téléchargent à
 * la demande les documents de leurs prestations (complément des notifications
 * e-mail). FR uniquement, noindex.
 */

const LOCALE = "fr";

export const RESSOURCES_BASE_PATH = `/${LOCALE}/espace-ressources`;
export const RESSOURCES_CONNEXION_PATH = `/${LOCALE}/espace-ressources/connexion`;

/**
 * Nom du cookie de session ressources. Module pur (Edge-safe) pour être
 * importable par le middleware (proxy.ts) ET par cookie.ts (Node).
 */
export const RESSOURCES_COOKIE_NAME = "ressources_session";

/** URL absolue de vérification d'un lien magique (pour l'e-mail). */
export function buildRessourcesMagicLinkUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  return `${base}/${LOCALE}/espace-ressources/connexion/${encodeURIComponent(token)}`;
}

/**
 * Href (relatif, locale-préfixé) de téléchargement d'un document. Pointe vers
 * une route serveur qui contrôle l'accès, signe l'URL R2 et redirige (302).
 * Utilisé dans un `<a href>` synchrone → immunisé aux bloqueurs de pop-up.
 */
export function buildRessourceDownloadHref(versionId: string, kind: "source" | "pdf"): string {
  return `/${LOCALE}/espace-ressources/telecharger/${versionId}?kind=${kind}`;
}
