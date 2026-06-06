/**
 * Qualiopi — Helpers purs de transition de statut du Formation Engine.
 *
 * Extraits de `src/server/actions/qualiopi/engine.ts` : ce dernier porte la
 * directive `"use server"` et est désormais importé par un composant client
 * (FormationLifecycleButtons → startGenerationAction). Or un module `"use server"`
 * référencé côté client ne peut exporter QUE des fonctions async (contrainte
 * Next.js « Server Actions must be async functions »). Ces helpers étant
 * synchrones, ils vivent dans ce module pur (importable partout, serveur comme
 * tests), tandis que engine.ts les consomme en interne.
 */

import type { FormationStatutGeneration } from "../../../../prisma/generated/client";

/**
 * Détermine le nouveau statutGeneration après approbation d'une FileValidation.
 * Retourne `null` si aucune transition n'est nécessaire (ex: validation structure).
 */
export function resolveNextStatutAfterApproval(
  etape: string,
  currentStatut: FormationStatutGeneration,
): FormationStatutGeneration | null {
  switch (etape) {
    case "contenu":
      // Contenu approuvé → contenu_valide (pipeline reprend vers assemble)
      return "contenu_valide";
    case "assemblage":
      // Assemblage approuvé → publie (validation finale humaine — AI Act)
      // Note : la publication finale reste gatée par publishFormationAction (T3)
      // qui requiert validatedBy. Ici on marque seulement l'avancement.
      return "publie";
    case "structure":
      // Validation structure → avance vers structure_validee si ce statut existe,
      // sinon reste sur structure_generee (le pipeline continue vers contenu_evalue)
      if (currentStatut === "structure_generee") return "contenu_evalue";
      return null;
    default:
      return null;
  }
}

/**
 * Détermine le statut de retour après rejet d'une FileValidation.
 */
export function resolveRevertStatutAfterRejection(etape: string): FormationStatutGeneration {
  switch (etape) {
    case "contenu":
      // Retour à structure_generee pour repartir de la structure
      return "structure_generee";
    case "assemblage":
      // Retour à contenu_genere pour corriger manuellement avant ré-assemblage
      return "contenu_genere";
    case "structure":
      // Retour à intention (re-démarrage complet)
      return "intention";
    default:
      return "intention";
  }
}
