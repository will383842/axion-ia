/**
 * Qualiopi — Gardes de conformité sur l'édition d'une Formation (WS4).
 *
 * Pourquoi :
 *   `updateFormationAction` / `setCertificationAction` muaient une Formation sans
 *   aucune garde. Deux risques de conformité :
 *
 *   1. INTÉGRITÉ DES SESSIONS LIVRÉES — une formation dont une session est en
 *      cours (`en_cours`) ou réalisée (`realisee`) est juridiquement figée : sa
 *      convention, son programme remis et son attestation engagent ce contenu
 *      exact. Le modifier rétroactivement falsifie la preuve Qualiopi. → on
 *      BLOQUE l'édition de structure ; l'admin archive + duplique pour une
 *      nouvelle version (WS6).
 *
 *   2. VALIDATION HUMAINE (AI Act art. 50) — éditer le contenu d'une formation
 *      déjà validée/publiée invalide sa validation. → on RÉINITIALISE
 *      `validatedBy`/`validatedAt` et on rétrograde `statutGeneration` hors de
 *      `publie`, forçant une re-validation puis re-publication.
 *
 * Helpers purs (testables sans DB) + un compteur de sessions verrouillantes.
 */

import type { PrismaClient, TrainingSessionStatut } from "../../../../prisma/generated/client";

/**
 * Statuts de session qui FIGENT le contenu de la formation : la prestation a
 * commencé (`en_cours`) ou s'est tenue (`realisee`). `planifiee`/`reportee`
 * n'ont pas encore engagé de livraison (le snapshot légal WS5 protège leurs
 * conventions déjà signées) ; `annulee` n'engage rien.
 */
export const LOCKING_SESSION_STATUTS: readonly TrainingSessionStatut[] = ["en_cours", "realisee"];

/** Entrée d'historique de version (audit éditorial / certification). */
export interface FormationVersionEntry {
  /** Version du programme APRÈS ce changement (cf. bumpProgrammeVersion). */
  version: string;
  /** Horodatage ISO 8601. */
  at: string;
  /** Auteur (userId admin) du changement. */
  by: string;
  /** Nature du changement. */
  action: "update" | "certification";
  /** Champs modifiés (clés). */
  fields: string[];
  /** True si le changement a invalidé une validation humaine existante. */
  revalidationRequired?: boolean;
}

/**
 * Incrémente la version mineure d'un programme (`"1.3"` → `"1.4"`). Tolère un
 * format inattendu en repartant de `"1.0"`.
 */
export function bumpProgrammeVersion(version: string | null | undefined): string {
  const m = /^(\d+)\.(\d+)$/.exec((version ?? "").trim());
  if (!m) return "1.0";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return `${major}.${minor + 1}`;
}

/**
 * Coerce un `versionHistorique` (Json libre) en tableau d'entrées et y ajoute
 * une entrée. Robuste à un historique absent/corrompu (repart d'un tableau vide).
 */
export function appendVersionEntry(
  history: unknown,
  entry: FormationVersionEntry,
): FormationVersionEntry[] {
  const base = Array.isArray(history) ? (history as FormationVersionEntry[]) : [];
  return [...base, entry];
}

/**
 * Retourne le nombre de sessions verrouillantes (en cours / réalisées) d'une
 * formation. > 0 ⇒ l'édition de structure est interdite.
 */
export async function countLockingSessions(
  db: Pick<PrismaClient, "trainingSession">,
  formationId: string,
): Promise<number> {
  return db.trainingSession.count({
    where: { formationId, statut: { in: [...LOCKING_SESSION_STATUTS] } },
  });
}

/** Message d'erreur unifié quand une session verrouille l'édition. */
export const LOCKED_BY_SESSION_ERROR =
  "Édition impossible : cette formation a au moins une session en cours ou réalisée " +
  "(contenu figé pour la conformité Qualiopi). Archivez-la puis dupliquez-la pour " +
  "créer une nouvelle version.";
