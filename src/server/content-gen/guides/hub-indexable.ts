import type { Metadata } from "next";
import { loadGuidesIndexForView } from "./loader";

/**
 * V1-17 — le hub `/fr/guides` n'est indexable que s'il liste au moins un guide.
 *
 * Tant qu'il est vide (page « Bientôt disponible »), il passe en
 * `noindex, follow` et sort de `pages.xml`. Dès qu'un guide est publié, les deux
 * se rétablissent seuls (ISR de la page 1 h, du sitemap 24 h) : aucun drapeau à
 * retourner. Sous les stubs de build (`stub.invalid`) le loader rend `[]` : le
 * hub est donc noindex à la construction, puis repris par l'ISR en production.
 */
export function hubGuidesIndexable(nombreDeGuides: number): boolean {
  return nombreDeGuides > 0;
}

export const ROBOTS_HUB_GUIDES_VIDE: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: true,
};

export async function hubGuidesEstIndexable(): Promise<boolean> {
  const guides = await loadGuidesIndexForView("fr", { limit: 1 });
  return hubGuidesIndexable(guides.length);
}
