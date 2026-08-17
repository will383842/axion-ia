/**
 * 🔴 QUELLES TRANSITIONS EXIGENT UN MOTIF — module PUR.
 *
 * ## Le défaut, constaté le 2026-08-17
 *
 * **Reporter** une session exigeait un motif : côté client (le bouton refuse
 * un champ vide) *et* côté serveur (`motif: z.string().min(1)`).
 *
 * **Annuler** n'en exigeait aucun. Un clic sur un bouton rouge, et c'était
 * fait. `reason` était pourtant accepté par le schéma — mais `.optional()`, et
 * l'écran ne l'envoyait jamais.
 *
 * ## Pourquoi l'asymétrie est un défaut, et pas une commodité
 *
 * Annuler est **plus** engageant que reporter, pas moins :
 *
 *   · reporter crée une nouvelle session — le dossier continue ailleurs ;
 *   · annuler révoque **en cascade les jetons d'émargement** de la session, et
 *     l'état `annulee` est **terminal** — aucune transition n'en sort.
 *
 * Un auditeur Qualiopi qui demande « pourquoi cette session a-t-elle été
 * annulée ? » n'obtenait donc aucune réponse : la donnée n'avait jamais été
 * demandée. Une session reportée savait se justifier, une session annulée non.
 *
 * ## Pourquoi ici, et pas dans un `if` de l'action
 *
 * La règle doit être lisible par l'écran (pour ouvrir le champ AVANT l'envoi)
 * et par le serveur (pour refuser). Deux copies d'une même frontière divergent
 * — l'écran demanderait un motif que le serveur n'exige plus, ou l'inverse, et
 * l'utilisateur verrait un refus qu'il ne peut pas comprendre.
 */

import type { TrainingSessionStatut } from "../../../../prisma/generated/client";

/**
 * Transitions dont le motif est OBLIGATOIRE.
 *
 * ⚠️ Le critère n'est pas « c'est destructif » mais **« l'état est terminal et
 * il détruit des accès »**. Marquer une session réalisée n'a pas à se
 * justifier : c'est le déroulé normal, et exiger une phrase à chaque fin de
 * session ferait taper « ok » vingt fois — un champ obligatoire qu'on remplit
 * de bruit ne trace rien, il fabrique juste de la friction.
 */
export const TRANSITIONS_EXIGEANT_MOTIF: ReadonlyArray<TrainingSessionStatut> = ["annulee"];

export function exigeUnMotif(toStatus: TrainingSessionStatut): boolean {
  return TRANSITIONS_EXIGEANT_MOTIF.includes(toStatus);
}

/** Longueur minimale utile. Un motif d'un caractère ne trace rien. */
export const MOTIF_MIN = 3;

/**
 * Le motif fourni est-il recevable pour cette transition ?
 *
 * @returns `null` si tout va bien, sinon la phrase à afficher — **la même**
 *   côté écran et côté serveur, pour que le refus soit toujours le même.
 */
export function refusMotif(
  toStatus: TrainingSessionStatut,
  motif: string | null | undefined,
): string | null {
  if (!exigeUnMotif(toStatus)) return null;
  const propre = (motif ?? "").trim();
  if (propre.length === 0) {
    return "Annuler une session est définitif et révoque les liens d'émargement : indiquez le motif.";
  }
  if (propre.length < MOTIF_MIN) {
    return `Le motif doit compter au moins ${MOTIF_MIN} caractères.`;
  }
  return null;
}
