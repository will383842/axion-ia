"use server";

/**
 * Console admin — gestion des comptes formateurs (2026-06-13).
 *
 * - `setFormateurActifAction` : (dés)active un compte → coupe/rétablit l'accès
 *   à l'espace formateur immédiatement (la garde relookup `Trainer.actif`).
 * - `sendFormateurLinkAction` : envoie un lien de connexion au formateur depuis
 *   la console (dépannage : le formateur peut aussi le demander lui-même).
 *
 * RBAC : `requireAdminWrite` (editor+) pour entrer ; l'ACTIVATION d'un
 * formateur indépendant exige en plus l'habilitation `habiliter_formateur` et
 * un dossier complet — c'est l'écrivain unique qui en juge (lot S1, ADR 0066).
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/intervention-documents/_guards";
import { enqueueEmail } from "@/server/queue/queues";
import { createFormateurMagicLink } from "@/server/formateur/magic-link";
import { buildFormateurMagicLinkUrl } from "@/server/formateur/routes";
import {
  changerActivationFormateur,
  messageRefusActivation,
} from "@/server/qualiopi/formateurs-independants/activation";

export interface AdminActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

const setActifSchema = z.object({ trainerId: z.string().uuid(), actif: z.boolean() });

export async function setFormateurActifAction(
  input: z.infer<typeof setActifSchema>,
): Promise<AdminActionResult> {
  const session = await requireAdminWrite();
  const parsed = setActifSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  // 🔴 Lot S1 : cette porte écrivait `actif` en direct, sans garde. Elle passe
  // désormais par l'écrivain unique, comme la fiche formateur.
  const r = await changerActivationFormateur({
    trainerId: parsed.data.trainerId,
    actif: parsed.data.actif,
    acteur: { type: "administrateur", session },
    motif: parsed.data.actif
      ? "activation_depuis_la_console_coaching"
      : "desactivation_depuis_la_console_coaching",
  });
  if (!r.ok) return { ok: false, error: messageRefusActivation(r) };
  // Le rafraîchissement UI est assuré par router.refresh() côté client
  // (FormateurAccountManager) — pas de revalidatePath ici car le préfixe admin
  // est secret ([adminPrefix]) et un chemin hardcodé ne matcherait jamais.
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
