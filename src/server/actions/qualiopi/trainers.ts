/**
 * Qualiopi — Server Actions formateurs (Trainer) — R9 audit E2E 2026-06-06.
 *
 * createTrainerAction       : crée un formateur (salarié ou sous-traitant).
 * updateTrainerAction       : met à jour les champs éditoriaux.
 * setTrainerHabilitationsAction : remplace la liste des formations habilitées.
 * verifyTrainerSousTraitantAction : marque la vérification data.gouv.fr (off.19/27).
 * setTrainerActifAction     : active / désactive un formateur.
 *
 * Guards RBAC write + audit ActivityLog. Email unique (P2002 → message clair).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  isTrainerHabilite,
  type TrainerHabilitationFields,
} from "@/server/qualiopi/trainers/trainers";

type ActionResult<T> = { data: T } | { error: string };

const TRAINER_STATUTS = ["salarie", "sous_traitant"] as const;

const createTrainerSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().min(1).max(200),
  email: z.string().email(),
  telephone: z.string().max(40).optional(),
  statut: z.enum(TRAINER_STATUTS),
  cvUrl: z.string().url().optional(),
  domainesCompetences: z.array(z.unknown()).optional(),
  formationsHabilitees: z.array(z.string().uuid()).optional(),
  dateEmbauche: z.coerce.date().optional(),
  tarifJourneeHtCents: z.number().int().min(0).optional(),
  sousTraitantNda: z.string().max(20).optional(),
});

const updateTrainerSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(200).optional(),
  prenom: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  telephone: z.string().max(40).optional(),
  statut: z.enum(TRAINER_STATUTS).optional(),
  cvUrl: z.string().url().optional(),
  domainesCompetences: z.array(z.unknown()).optional(),
  dateEmbauche: z.coerce.date().optional(),
  tarifJourneeHtCents: z.number().int().min(0).optional(),
  sousTraitantNda: z.string().max(20).optional(),
});

const setHabilitationsSchema = z.object({
  id: z.string().uuid(),
  formationsHabilitees: z.array(z.string().uuid()),
});

const verifySousTraitantSchema = z.object({
  id: z.string().uuid(),
  sousTraitantNda: z.string().min(1).max(20),
});

const setActifSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un formateur. Email unique (sinon erreur explicite). */
export async function createTrainerAction(
  input: z.infer<typeof createTrainerSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  try {
    const created = await prisma.trainer.create({
      data: {
        nom: v.nom,
        prenom: v.prenom,
        email: v.email,
        statut: v.statut,
        ...(v.telephone !== undefined ? { telephone: v.telephone } : {}),
        ...(v.cvUrl !== undefined ? { cvUrl: v.cvUrl, cvUploadedAt: new Date() } : {}),
        ...(v.domainesCompetences !== undefined
          ? { domainesCompetences: v.domainesCompetences as never }
          : {}),
        ...(v.formationsHabilitees !== undefined
          ? { formationsHabilitees: v.formationsHabilitees }
          : {}),
        ...(v.dateEmbauche !== undefined ? { dateEmbauche: v.dateEmbauche } : {}),
        ...(v.tarifJourneeHtCents !== undefined
          ? { tarifJourneeHtCents: v.tarifJourneeHtCents }
          : {}),
        ...(v.sousTraitantNda !== undefined ? { sousTraitantNda: v.sousTraitantNda } : {}),
      },
      select: { id: true },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainer.create",
      targetType: "Trainer",
      targetId: created.id,
      changes: { nom: v.nom, prenom: v.prenom, email: v.email, statut: v.statut },
      session,
    });

    return { data: { id: created.id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un formateur avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la création du formateur." };
  }
}

/** Met à jour les champs éditoriaux d'un formateur. */
export async function updateTrainerAction(
  input: z.infer<typeof updateTrainerSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, ...fields } = parsed.data;

  try {
    await prisma.trainer.update({
      where: { id },
      data: {
        ...(fields.nom !== undefined ? { nom: fields.nom } : {}),
        ...(fields.prenom !== undefined ? { prenom: fields.prenom } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.telephone !== undefined ? { telephone: fields.telephone } : {}),
        ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
        ...(fields.cvUrl !== undefined ? { cvUrl: fields.cvUrl, cvUploadedAt: new Date() } : {}),
        ...(fields.domainesCompetences !== undefined
          ? { domainesCompetences: fields.domainesCompetences as never }
          : {}),
        ...(fields.dateEmbauche !== undefined ? { dateEmbauche: fields.dateEmbauche } : {}),
        ...(fields.tarifJourneeHtCents !== undefined
          ? { tarifJourneeHtCents: fields.tarifJourneeHtCents }
          : {}),
        ...(fields.sousTraitantNda !== undefined
          ? { sousTraitantNda: fields.sousTraitantNda }
          : {}),
      },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainer.update",
      targetType: "Trainer",
      targetId: id,
      changes: fields,
      session,
    });

    return { data: { id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un formateur avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la mise à jour du formateur." };
  }
}

/** Remplace la liste des formations habilitées d'un formateur. */
export async function setTrainerHabilitationsAction(
  input: z.infer<typeof setHabilitationsSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setHabilitationsSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, formationsHabilitees } = parsed.data;

  try {
    await prisma.trainer.update({ where: { id }, data: { formationsHabilitees } });
  } catch {
    return { error: "Erreur lors de la mise à jour des habilitations." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.habilitations",
    targetType: "Trainer",
    targetId: id,
    changes: { formationsHabilitees },
    session,
  });

  return { data: { id } };
}

/**
 * Marque un sous-traitant comme vérifié (data.gouv.fr) — off.19/27.
 * Pose `sousTraitantVerifieAt = now` et enregistre le NDA.
 */
export async function verifyTrainerSousTraitantAction(
  input: z.infer<typeof verifySousTraitantSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = verifySousTraitantSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, sousTraitantNda } = parsed.data;

  try {
    await prisma.trainer.update({
      where: { id },
      data: { sousTraitantNda, sousTraitantVerifieAt: new Date() },
    });
  } catch {
    return { error: "Erreur lors de la vérification du sous-traitant." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.verify_sous_traitant",
    targetType: "Trainer",
    targetId: id,
    changes: { sousTraitantNda },
    session,
  });

  return { data: { id } };
}

/** Active / désactive un formateur (un inactif ne peut plus être assigné). */
export async function setTrainerActifAction(
  input: z.infer<typeof setActifSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setActifSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, actif } = parsed.data;

  try {
    await prisma.trainer.update({ where: { id }, data: { actif } });
  } catch {
    return { error: "Erreur lors du changement de statut du formateur." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer.set_actif",
    targetType: "Trainer",
    targetId: id,
    changes: { actif },
    session,
  });

  return { data: { id } };
}

const assignTrainerSchema = z.object({
  sessionId: z.string().uuid(),
  /** null = retirer le formateur principal de la session. */
  trainerId: z.string().uuid().nullable(),
});

/**
 * Assigne (ou retire) le formateur principal d'une session — R9.
 *
 * BLOCAGE D'HABILITATION (off.6/19) : refuse si le formateur n'est pas habilité
 * sur la formation de la session, inactif, ou sous-traitant non vérifié.
 * `trainerId = null` retire l'assignation (toujours autorisé).
 */
export async function assignTrainerToSessionAction(
  input: z.infer<typeof assignTrainerSchema>,
): Promise<ActionResult<{ sessionId: string }>> {
  const session = await requireAdminWrite();
  const parsed = assignTrainerSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { sessionId, trainerId } = parsed.data;

  let trainingSession: { formationId: string } | null;
  try {
    trainingSession = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { formationId: true },
    });
  } catch {
    return { error: "Erreur lors de la lecture de la session" };
  }
  if (!trainingSession) return { error: "Session introuvable" };

  if (trainerId !== null) {
    let trainer: TrainerHabilitationFields | null;
    try {
      trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        select: {
          actif: true,
          statut: true,
          formationsHabilitees: true,
          sousTraitantVerifieAt: true,
        },
      });
    } catch {
      return { error: "Erreur lors de la lecture du formateur" };
    }
    if (!trainer) return { error: "Formateur introuvable" };

    const check = isTrainerHabilite(trainer, trainingSession.formationId);
    if (!check.ok) {
      return { error: `Assignation refusée : ${check.raison}` };
    }
  }

  try {
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { formateurPrincipalId: trainerId },
    });
  } catch {
    return { error: "Erreur lors de l'assignation du formateur" };
  }

  await logQualiopiActivity({
    action: "qualiopi.session.assign_formateur",
    targetType: "TrainingSession",
    targetId: sessionId,
    changes: { formateurPrincipalId: trainerId },
    session,
  });

  return { data: { sessionId } };
}
