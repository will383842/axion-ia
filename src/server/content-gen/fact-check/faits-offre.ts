/**
 * Faits de référence de l'offre Journée IA pour le contrôle de fidélité : dérivés de la
 * SOURCE UNIQUE (`journee-ia-commun.ts`, `pricing.ts`), donc présents même quand les fiches
 * du pack ne sont pas (encore) en base. Lève si la source est illisible (échec fermé).
 */

import { faitsJourneeIAPourRelecture } from "../knowledge/journee-ia-fiche";
import type { FicheReference } from "./fidelite-llm";

/** Ne peut pas entrer en collision avec un identifiant de fiche de la base (uuid). */
export const ID_FAITS_OFFRE = "source-unique-journee-ia";

export function faitsReferenceOffre(): FicheReference {
  return {
    id: ID_FAITS_OFFRE,
    titre: "Journée IA : faits du site (source unique)",
    texte: faitsJourneeIAPourRelecture(),
  };
}
