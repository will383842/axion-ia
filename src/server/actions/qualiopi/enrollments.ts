/**
 * Qualiopi — Server Actions Inscriptions (Enrollment) T3.
 *
 * enrollTraineeAction            : inscrit un stagiaire à une session.
 * updateEnrollmentPresenceAction : met à jour le taux de présence + émargement.
 * setEnrollmentStatutAction      : change le statut d'une inscription.
 *
 * Idempotence enrollTraineeAction : P2002 sur @@unique [sessionId, traineeId]
 * → retour error "déjà inscrit" (pas de doublon silencieux).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { creerQuestionnaire } from "@/server/qualiopi/satisfaction/satisfaction-service";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Enums Zod
// ─────────────────────────────────────────────────────────────────────────────

const ENROLLMENT_STATUTS = ["planifiee", "presente", "abandon", "exclu"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const enrollTraineeSchema = z.object({
  sessionId: z.string().uuid(),
  traineeId: z.string().uuid(),
});

const updateEnrollmentPresenceSchema = z.object({
  id: z.string().uuid(),
  tauxPresencePct: z.number().int().min(0).max(100),
  emargementSigneAt: z.coerce.date().optional(),
});

const setEnrollmentStatutSchema = z.object({
  id: z.string().uuid(),
  statut: z.enum(ENROLLMENT_STATUTS),
});

const setEnrollmentAdaptationsSchema = z.object({
  id: z.string().uuid(),
  // Adaptations réellement réalisées pour ce bénéficiaire (individualisation,
  // rythme, supports, situation de handicap). Vide → efface le champ (null).
  adaptationsRealisees: z.string().trim().max(5000),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inscrit un stagiaire à une session de formation.
 *
 * Statut initial : 'planifiee'.
 * @@unique [sessionId, traineeId] : P2002 → error "déjà inscrit".
 */
export async function enrollTraineeAction(input: {
  sessionId: string;
  traineeId: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = enrollTraineeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  let created: { id: string };
  try {
    created = await prisma.enrollment.create({
      data: {
        sessionId: v.sessionId,
        traineeId: v.traineeId,
        statut: "planifiee",
      },
      select: { id: true },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return { error: "Ce stagiaire est déjà inscrit à cette session" };
    return { error: "Erreur lors de l'inscription" };
  }

  // Les 3 questionnaires naissent AVEC l'inscription (idempotent) : le
  // positionnement (ind. 8) est disponible dans le portail sans attendre un
  // clic admin, et les relances J+1/J+30 ne pointent jamais vers un portail
  // vide. Fail-soft : les crons J+1/J+30 re-garantissent chaud/froid.
  for (const type of ["positionnement", "satisfaction_chaud", "satisfaction_froid"] as const) {
    try {
      await creerQuestionnaire({ enrollmentId: created.id, type });
    } catch {
      // fail-soft par questionnaire
    }
  }

  await logQualiopiActivity({
    action: "qualiopi.enrollment.create",
    targetType: "Enrollment",
    targetId: created.id,
    changes: { sessionId: v.sessionId, traineeId: v.traineeId },
    session,
  });

  return { data: { id: created.id } };
}

/**
 * Met à jour le taux de présence et la date de signature de l'émargement.
 * Appelé lors du traitement de la feuille d'émargement (post-session).
 */
export async function updateEnrollmentPresenceAction(input: {
  id: string;
  tauxPresencePct: number;
  emargementSigneAt?: Date;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateEnrollmentPresenceSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  await prisma.enrollment.update({
    where: { id },
    data: {
      tauxPresencePct: fields.tauxPresencePct,
      ...(fields.emargementSigneAt !== undefined
        ? { emargementSigneAt: fields.emargementSigneAt }
        : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.enrollment.presence",
    targetType: "Enrollment",
    targetId: id,
    changes: { tauxPresencePct: fields.tauxPresencePct },
    session,
  });

  return { data: { id } };
}

/**
 * Change le statut d'une inscription (planifiee → presente / abandon / exclu).
 */
export async function setEnrollmentStatutAction(input: {
  id: string;
  statut: (typeof ENROLLMENT_STATUTS)[number];
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setEnrollmentStatutSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, statut } = parsed.data;

  await prisma.enrollment.update({
    where: { id },
    data: { statut },
  });

  await logQualiopiActivity({
    action: `qualiopi.enrollment.statut.${statut}`,
    targetType: "Enrollment",
    targetId: id,
    changes: { statut },
    session,
  });

  return { data: { id } };
}

/**
 * Renseigne les adaptations RÉELLEMENT réalisées pour une inscription
 * (indicateur 10 : adaptation de la prestation / accompagnement individualisé,
 * situations de handicap). Sans ce write-path, le champ restait toujours null et
 * off.10 était structurellement incouvrable (cf. audit 2026-07-14). Une chaîne
 * vide efface le champ (null).
 */
export async function setEnrollmentAdaptationsAction(input: {
  id: string;
  adaptationsRealisees: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setEnrollmentAdaptationsSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, adaptationsRealisees } = parsed.data;
  const value = adaptationsRealisees.length > 0 ? adaptationsRealisees : null;

  await prisma.enrollment.update({
    where: { id },
    data: { adaptationsRealisees: value },
  });

  await logQualiopiActivity({
    action: "qualiopi.enrollment.adaptations",
    targetType: "Enrollment",
    targetId: id,
    changes: { adaptationsRenseignees: value !== null },
    session,
  });

  return { data: { id } };
}
