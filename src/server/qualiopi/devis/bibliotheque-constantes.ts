/**
 * Codes de la bibliothèque des textes du devis à formules (CHECK SQL de
 * `devis_textes_bibliotheque`). Hors du fichier « use server » : un tel fichier
 * n'exporte que des fonctions asynchrones.
 */
export const FORMULES_BIBLIOTHEQUE = ["achat", "abonnement", "commun"] as const;
export const NATURES_BIBLIOTHEQUE = ["avantage", "inconvenient", "prerequis", "clause"] as const;

export interface TexteBibliotheque {
  id: string;
  formule: string;
  nature: string;
  texte: string;
  actifParDefaut: boolean;
  ordre: number;
  version: number;
  aValider: boolean;
}
