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
      // 🔴 `D2-1-02` (2026-08-20) — RENDAIT `publie`, ET LE COMMENTAIRE DISAIT
      // L'INVERSE.
      //
      // Le commentaire d'origine affirmait : « la publication finale reste gatée
      // par publishFormationAction (T3) qui requiert validatedBy. Ici on marque
      // seulement l'avancement. » C'était faux, et c'est ce qui rendait le
      // défaut invisible : `statutGeneration = "publie"` EST la publication.
      // C'est exactement le prédicat que lisent le créateur de sessions
      // (`sessions/new/page.tsx`) et le tunnel de vente (`vente/new/page.tsx`) :
      // `{ statut: "actif", statutGeneration: "publie" }`.
      //
      // Approuver un assemblage rendait donc la formation **publique et
      // vendable** :
      //   · sans `validatedBy` — la validation humaine qu'impose l'AI Act
      //     art. 50, et que `publishFormationAction` exige explicitement ;
      //   · sans le plancher de ratio pratique (Qualiopi) ;
      //   · sous `requireAdminWrite`, donc accessible au rôle `editor`, alors
      //     que publier exige `requireAdminPublish`.
      //
      // Trois gardes contournées par une porte latérale, pendant qu'un
      // commentaire rassurait le lecteur.
      //
      // Le statut `assemble` existe dans l'enum Prisma et n'était utilisé par
      // AUCUN chemin : c'est précisément l'état « assemblé, pas encore publié »
      // que ce cas aurait dû rendre. Le pipeline s'y arrête désormais, et la
      // publication redevient l'acte séparé et gardé qu'elle prétendait être.
      //
      // ⚠️ Aucun cul-de-sac : `validateFormationAction` pose `validatedBy`,
      // puis `publishFormationAction` publie. Le chemin Valider → Publier est
      // complet — vérifié avant d'écrire ceci.
      return "assemble";
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
      // 🔴 Retour à `contenu_valide`, PAS `contenu_genere` : `contenu_genere`
      // est un cul-de-sac (ni relançable par startGenerationAction, ni
      // resetable, no-op côté worker) — le « corriger puis relancer » promis
      // était impossible. `contenu_valide` est le statut d'où le worker
      // ré-assemble : après correction manuelle, la relance re-déroule
      // stepAssemble et re-soumet une validation d'assemblage.
      return "contenu_valide";
    case "structure":
      // Retour à intention (re-démarrage complet)
      return "intention";
    default:
      return "intention";
  }
}
