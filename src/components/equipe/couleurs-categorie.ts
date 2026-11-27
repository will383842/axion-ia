import { CATEGORIES } from "@/lib/equipe";
import type { Categorie } from "@/lib/equipe";

/**
 * Couleurs d'une catégorie, exprimées en jetons EXISTANTS de `globals.css` (aucun jeton neuf, aucun hex).
 * - `forme` : la couleur de la pastille et des points (contraste ≥ 3:1 exigé sur l'ivoire) ;
 * - `fort`  : la variante qui porte du TEXTE sur l'ivoire, ou une lettre ivoire sur fond plein (≥ 4,5:1).
 * Le test `contraste-categories.spec.ts` lit `globals.css` et vérifie ces seuils.
 */
const FORT: Readonly<Record<(typeof CATEGORIES)[Categorie]["jetonCouleur"], string>> = {
  terracotta: "terracotta",
  ochre: "ochre-deep",
  sage: "sage",
  plum: "plum",
  mocha: "mocha",
};

export interface CouleursCategorie {
  forme: string;
  fort: string;
}

export function jetonsDe(categorie: Categorie): CouleursCategorie {
  const base = CATEGORIES[categorie].jetonCouleur;
  return { forme: base, fort: FORT[base] ?? base };
}

export const varCss = (jeton: string): string => `var(--color-${jeton})`;
