"use server";

/**
 * Console admin — gestion des comptes formateurs (2026-06-13).
 *
 * - `setFormateurActifAction` : (dés)active un compte → coupe/rétablit l'accès
 *   à l'espace formateur immédiatement (la garde relookup `Trainer.actif`).
 * - `sendFormateurLinkAction` : envoie un lien de connexion au formateur depuis
 *   la console (dépannage : le formateur peut aussi le demander lui-même).
 *
 * RBAC : `requireAdminWrite` (editor+).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/intervention-documents/_guards";
import { enqueueEmail } from "@/server/queue/queues";
import { createFormateurMagicLink } from "@/server/formateur/magic-link";
import { buildFormateurMagicLinkUrl } from "@/server/formateur/routes";

export interface AdminActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

const setActifSchema = z.object({ trainerId: z.string().uuid(), actif: z.boolean() });

export async function setFormateurActifAction(
  input: z.infer<typeof setActifSchema>,
): Promise<AdminActionResult> {
  await requireAdminWrite();
  const parsed = setActifSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  await prisma.trainer.update({
    where: { id: parsed.data.trainerId },
    data: { actif: parsed.data.actif },
  });
  revalidatePath(`/fr/admin/coaching/formateurs`);
  return { ok: true };
}

const sendLinkSchema = z.object({ trainerId: z.string().uuid() });

export async function sendFormateurLinkAction(
  input: z.infer<typeof sendLinkSchema>,
): Promise<AdminActionResult> {
  await requireAdminWrite();
  const parsed = sendLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  const trainer = await prisma.trainer.findUnique({
    where: { id: parsed.data.trainerId },
    select: { id: true, email: true, prenom: true, nom: true, actif: true },
  });
  if (!trainer) return { ok: false, error: "Formateur introuvable." };
  if (!trainer.actif) return { ok: false, error: "Compte désactivé : réactivez-le d'abord." };

  const token = await createFormateurMagicLink(trainer.id, null);
  await enqueueEmail("formateur-magic-link", trainer.email, "fr", {
    magicLink: buildFormateurMagicLinkUrl(token),
    formateurNom: trainer.prenom || trainer.nom || undefined,
    expiresInMin: 15,
  });
  return { ok: true };
}
