/**
 * Qualiopi — Server Actions Évaluations des acquis (T9).
 *
 * createEvaluationAcquisAction : enregistre une évaluation avec calcul automatique
 *   du score/niveau/réussite via l'AGENT A (evaluations-service).
 * genererAttestationAction : génère (ou renvoie) l'attestation d'un stagiaire
 *   via l'AGENT A (attestation-service). Idempotent si force=false.
 *
 * Pattern : requireAdminWrite + Zod + ActionResult + logQualiopiActivity.
 * Voir src/server/actions/qualiopi/enrollments.ts comme référence.
 */

"use server";

import { z } from "zod";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { genererAttestationPourEnrollment } from "@/server/qualiopi/evaluations/attestation-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const competenceSchema = z.object({
  libelle: z.string().min(1),
  note: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  observations: z.string().optional(),
  objectifRef: z.string().optional(),
});

const createEvaluationAcquisSchema = z.object({
  enrollmentId: z.string().uuid(),
  type: z.enum(["initiale", "intermediaire", "finale"]),
  dateEvaluation: z.string().min(1),
  competences: z.array(competenceSchema).min(1),
  recommandations: z.string().optional(),
});

const genererAttestationSchema = z.object({
  enrollmentId: z.string().uuid(),
  force: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une évaluation des acquis pour une inscription.
 *
 * Délègue le calcul score/niveau/réussite à `createEvaluation` (AGENT A).
 * Trace dans l'audit trail (indicateur 11 Qualiopi).
 */
export async function createEvaluationAcquisAction(input: {
  enrollmentId: string;
  type: "initiale" | "intermediaire" | "finale";
  dateEvaluation: string;
  competences: Array<{
    libelle: string;
    note?: 1 | 2 | 3;
    observations?: string;
    objectifRef?: string;
  }>;
  recommandations?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createEvaluationAcquisSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let created: { id: string };
  try {
    created = await createEvaluation({
      enrollmentId: v.enrollmentId,
      type: v.type,
      dateEvaluation: v.dateEvaluation,
      // Zod retourne `T | undefined` pour les propriétés optionnelles → cast nécessaire
      // en exactOptionalPropertyTypes:true (les propriétés absentes ne sont pas undefined).
      competences: v.competences as Array<{
        libelle: string;
        note?: 1 | 2 | 3;
        observations?: string;
        objectifRef?: string;
      }>,
      ...(v.recommandations !== undefined ? { recommandations: v.recommandations } : {}),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur lors de la création de l'évaluation",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.evaluation.create",
    targetType: "EvaluationAcquis",
    targetId: created.id,
    changes: {
      enrollmentId: v.enrollmentId,
      type: v.type,
      dateEvaluation: v.dateEvaluation,
      nbCompetences: v.competences.length,
    },
    session,
  });

  return { data: { id: created.id } };
}

/**
 * Génère (ou renvoie existante) l'attestation de réalisation d'un stagiaire.
 *
 * Délègue entièrement à `genererAttestationPourEnrollment` (AGENT A) :
 * classement présence, construction PDF, mise à jour Enrollment.
 * Idempotent sauf si `force=true`.
 */
export async function genererAttestationAction(input: {
  enrollmentId: string;
  force?: boolean;
}): Promise<
  ActionResult<{ resultat: "complete" | "partielle" | "aucune"; documentId: string | null }>
> {
  const session = await requireAdminWrite();
  const parsed = genererAttestationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let resultat: "complete" | "partielle" | "aucune";
  let documentId: string | null;
  try {
    const res = await genererAttestationPourEnrollment(v.enrollmentId, {
      ...(v.force !== undefined ? { force: v.force } : {}),
    });
    resultat = res.resultat;
    documentId = res.documentId;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur lors de la génération de l'attestation",
    };
  }

  await logQualiopiActivity({
    action: "qualiopi.attestation.generer",
    targetType: "Enrollment",
    targetId: v.enrollmentId,
    changes: { resultat, documentId, force: v.force ?? false },
    session,
  });

  return { data: { resultat, documentId } };
}
