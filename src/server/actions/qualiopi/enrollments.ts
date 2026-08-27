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
import { STATUTS_SORTIS } from "@/server/qualiopi/inscriptions/inscriptions-actives";

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
  /**
   * Motif de SORTIE du dispositif. Obligatoire dès que `statut` est un statut
   * de sortie, ignoré sinon — la validation croisée vit dans l'action, parce
   * qu'elle doit dériver de `STATUTS_SORTIS` et non d'une liste recopiée ici.
   */
  motif: z.string().trim().max(500).optional(),
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
  motif?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setEnrollmentStatutSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, statut, motif } = parsed.data;

  // 🔴 UNE SORTIE A UNE DATE ET UNE RAISON (2026-08-27).
  //
  // Cette action n'écrivait QUE le statut. `abandon` et `exclu` étaient
  // pourtant bien câblés partout ailleurs — hors des inscriptions actives, hors
  // des moyennes de présence, hors de la génération automatique d'attestation,
  // et comptés par l'indicateur `m4_taux_abandon`. Il manquait le QUAND et le
  // POURQUOI : sans date, impossible de dire combien d'heures ont été suivies ;
  // sans motif, l'indicateur rend un chiffre que personne ne peut analyser.
  //
  // 🔑 `STATUTS_SORTIS` est IMPORTÉ, jamais recopié : le jour où un statut de
  // sortie s'ajoute à l'énumération, il est daté et motivé sans qu'on y pense.
  // Une liste écrite ici serait invisible depuis le SSOT — c'est exactement la
  // dérive corrigée sur les gardes de rôle le même jour.
  const estSortie = (STATUTS_SORTIS as readonly string[]).includes(statut);
  const motifPropre = motif?.trim() ?? "";

  if (estSortie && motifPropre === "") {
    return {
      error:
        "Indiquez le motif de la sortie (abandon ou exclusion) : sans lui, le taux " +
        "d'abandon reste un chiffre que personne ne peut analyser.",
    };
  }

  await prisma.enrollment.update({
    where: { id },
    data: estSortie
      ? { statut, sortieAt: new Date(), sortieMotif: motifPropre }
      : // Retour à un statut actif : on EFFACE la date et le motif. Sans cela,
        // une sortie annulée laisserait une date fantôme que les rapports
        // liraient comme une sortie réelle. La contrainte CHECK de la base
        // refuse d'ailleurs cette combinaison.
        { statut, sortieAt: null, sortieMotif: null },
  });

  await logQualiopiActivity({
    action: `qualiopi.enrollment.statut.${statut}`,
    targetType: "Enrollment",
    targetId: id,
    changes: estSortie ? { statut, motif: motifPropre } : { statut },
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
