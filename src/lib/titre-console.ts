import type { Metadata } from "next";

/**
 * Titre et robots du layout de la console (V1-16).
 *
 * Le titre ne dépend QUE de l'état de la session, jamais de la validité du
 * préfixe d'URL : sinon l'onglet d'une 404 révélerait le préfixe secret.
 */
export const TITRE_CONSOLE = "Console admin";
export const TITRE_INTROUVABLE = "Page introuvable";

export function metadataConsole(authentifie: boolean): Metadata {
  return {
    title: { default: authentifie ? TITRE_CONSOLE : TITRE_INTROUVABLE, template: "%s" },
    robots: { index: false, follow: false },
  };
}
