/**
 * Qualiopi — Server Actions stagiaires (Trainee) — R10 audit E2E 2026-06-06.
 *
 * createTraineeAction : crée un stagiaire (PII handicap chiffré AES-256-GCM).
 * updateTraineeAction : met à jour les champs éditoriaux (handicap re-chiffré).
 *
 * RGPD : `handicapDetails` n'est JAMAIS stocké en clair → encryptPii. Le détail
 * en clair ne transite que de l'admin vers l'action (write-only). La suppression
 * (anonymisation art. 17) reste gérée par rgpd-service.supprimerStagiaire.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { encryptPii } from "@/lib/pii-crypto";

type ActionResult<T> = { data: T } | { error: string };

const createTraineeSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().min(1).max(200),
  email: z.string().email(),
  telephone: z.string().max(40).optional(),
  entreprise: z.string().max(250).optional(),
  fonction: z.string().max(200).optional(),
  situationHandicap: z.boolean().optional(),
  /** Détail handicap EN CLAIR — chiffré avant stockage (jamais persisté en clair). */
  handicapDetails: z.string().max(2000).optional(),
  consentementFormation: z.boolean().optional(),
  consentementEmail: z.boolean().optional(),
  consentementVersion: z.string().max(20).optional(),
});

const updateTraineeSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(200).optional(),
  prenom: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  telephone: z.string().max(40).optional(),
  entreprise: z.string().max(250).optional(),
  fonction: z.string().max(200).optional(),
  situationHandicap: z.boolean().optional(),
  handicapDetails: z.string().max(2000).optional(),
  consentementFormation: z.boolean().optional(),
  consentementEmail: z.boolean().optional(),
  consentementVersion: z.string().max(20).optional(),
});

/** Crée un stagiaire. Email unique. PII handicap chiffré. */
export async function createTraineeAction(
  input: z.infer<typeof createTraineeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = createTraineeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const hasHandicapDetails = v.handicapDetails !== undefined && v.handicapDetails.trim() !== "";
  const situationHandicap = v.situationHandicap ?? hasHandicapDetails;

  try {
    const created = await prisma.trainee.create({
      data: {
        nom: v.nom,
        prenom: v.prenom,
        email: v.email,
        situationHandicap,
        ...(v.telephone !== undefined ? { telephone: v.telephone } : {}),
        ...(v.entreprise !== undefined ? { entreprise: v.entreprise } : {}),
        ...(v.fonction !== undefined ? { fonction: v.fonction } : {}),
        ...(hasHandicapDetails
          ? { handicapDetailsChiffre: encryptPii(v.handicapDetails as string) }
          : {}),
        ...(v.consentementFormation !== undefined
          ? { consentementFormation: v.consentementFormation }
          : {}),
        ...(v.consentementEmail !== undefined ? { consentementEmail: v.consentementEmail } : {}),
        ...(v.consentementVersion !== undefined
          ? { consentementVersion: v.consentementVersion, consentementAt: new Date() }
          : {}),
      },
      select: { id: true },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainee.create",
      targetType: "Trainee",
      targetId: created.id,
      // Ne jamais logguer le détail handicap (PII) — seulement le booléen.
      changes: { nom: v.nom, prenom: v.prenom, email: v.email, situationHandicap },
      session,
    });

    return { data: { id: created.id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un stagiaire avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la création du stagiaire." };
  }
}

/** Met à jour un stagiaire. Le détail handicap fourni est re-chiffré. */
export async function updateTraineeAction(
  input: z.infer<typeof updateTraineeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateTraineeSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, handicapDetails, consentementVersion, ...fields } = parsed.data;

  const hasHandicapDetails = handicapDetails !== undefined && handicapDetails.trim() !== "";

  try {
    await prisma.trainee.update({
      where: { id },
      data: {
        ...(fields.nom !== undefined ? { nom: fields.nom } : {}),
        ...(fields.prenom !== undefined ? { prenom: fields.prenom } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.telephone !== undefined ? { telephone: fields.telephone } : {}),
        ...(fields.entreprise !== undefined ? { entreprise: fields.entreprise } : {}),
        ...(fields.fonction !== undefined ? { fonction: fields.fonction } : {}),
        ...(fields.situationHandicap !== undefined
          ? { situationHandicap: fields.situationHandicap }
          : {}),
        ...(hasHandicapDetails
          ? { handicapDetailsChiffre: encryptPii(handicapDetails as string) }
          : {}),
        ...(fields.consentementFormation !== undefined
          ? { consentementFormation: fields.consentementFormation }
          : {}),
        ...(fields.consentementEmail !== undefined
          ? { consentementEmail: fields.consentementEmail }
          : {}),
        ...(consentementVersion !== undefined
          ? { consentementVersion, consentementAt: new Date() }
          : {}),
      },
    });

    await logQualiopiActivity({
      action: "qualiopi.trainee.update",
      targetType: "Trainee",
      targetId: id,
      changes: { ...fields, handicapDetailsModifie: hasHandicapDetails },
      session,
    });

    return { data: { id } };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "Un stagiaire avec cet email existe déjà." };
    }
    return { error: "Erreur lors de la mise à jour du stagiaire." };
  }
}
