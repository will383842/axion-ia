import type { Categorie } from "./types";

/**
 * Catégorie de la base (`TeamMember.category`, tirets bas) → catégorie du gabarit (tirets).
 * « autres » n'a pas de couleur propre : elle prend celle du partenaire (mocha, neutre).
 */
export function categoriePublique(categorieBase: string): Categorie {
  switch (categorieBase) {
    case "direction":
      return "direction";
    case "apporteur":
      return "apporteur";
    case "developpeur":
      return "developpeur";
    case "specialiste_ia":
      return "specialiste-ia";
    default:
      return "partenaire";
  }
}
