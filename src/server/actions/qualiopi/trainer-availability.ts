/**
 * Qualiopi — Server Actions sur les indisponibilités des formateurs.
 *
 * Congés, maladie, formation interne. Une indisponibilité empêche d'affecter le
 * formateur — mais elle n'est PAS un blocage dur à l'affectation : le hub la
 * signale, un humain arbitre (un formateur peut écourter ses congés). Bloquer
 * empêcherait de saisir la réalité quand elle est inconfortable.
 *
 * Bornes de jour INCLUSES (cf. `availability.ts`) : « du 3 au 7 » = 5 jours.
 * Une fenêtre inversée est refusée ici ET par le CHECK SQL `ck_availability_bornes` :
 * la garde applicative donne un message clair, la contrainte protège la donnée.
 *
 * Guards RBAC write + audit ActivityLog, comme les autres actions Qualiopi.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

type ActionResult<T> = { data: T } | { error: string };

const TYPES = ["conge", "maladie", "formation_interne", "indisponible"] as const;

/** `YYYY-MM-DD` → `Date` à minuit UTC (colonne `DATE`, sans fuseau). */
const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Date invalide" });

const createSchema = z
  .object({
    trainerId: z.string().uuid(),
    type: z.enum(TYPES),
    dateDebut: jour,
    dateFin: jour,
    motif: z.string().max(2000).optional(),
  })
  .refine((v) => v.dateFin >= v.dateDebut, {
    message: "La fin doit suivre le début (bornes incluses : « du 3 au 3 » est un jour).",
    path: ["dateFin"],
  });

export async function createTrainerAvailabilityAction(
  // `z.input` et non `z.infer` : le schéma TRANSFORME les dates (string → Date).
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  let id: string;
  try {
    const created = await prisma.trainerAvailability.create({
      data: {
        trainerId: v.trainerId,
        type: v.type,
        dateDebut: v.dateDebut,
        dateFin: v.dateFin,
        motif: v.motif ?? null,
        createdById: session.userId,
      },
      select: { id: true },
    });
    id = created.id;
  } catch {
    return { error: "Erreur lors de l'enregistrement de l'indisponibilité." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer_availability.create",
    targetType: "TrainerAvailability",
    targetId: id,
    changes: { trainerId: v.trainerId, type: v.type },
    session,
  });

  return { data: { id } };
}

const deleteSchema = z.object({ id: z.string().uuid() });

/**
 * Supprime une indisponibilité. Suppression DURE et non archivage : une
 * indisponibilité annulée n'a pas d'existence comptable ou légale — contrairement
 * à une ligne d'honoraires, qu'on ne détruit jamais.
 */
export async function deleteTrainerAvailabilityAction(
  input: z.input<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  try {
    await prisma.trainerAvailability.delete({ where: { id: parsed.data.id } });
  } catch {
    return { error: "Indisponibilité introuvable." };
  }

  await logQualiopiActivity({
    action: "qualiopi.trainer_availability.delete",
    targetType: "TrainerAvailability",
    targetId: parsed.data.id,
    session,
  });

  return { data: { id: parsed.data.id } };
}
