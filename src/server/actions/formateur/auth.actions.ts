"use server";

/**
 * Espace formateur — actions d'authentification passwordless (2026-06-13).
 *
 * `sendFormateurMagicLinkAction` : reçoit un e-mail, et SI un formateur actif
 * porte cet e-mail, lui envoie un lien de connexion magique. Réponse TOUJOURS
 * générique (anti-énumération d'e-mails). Rate-limité par IP et par e-mail.
 *
 * `logoutFormateurAction` : supprime le cookie de session.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/server/queue/queues";
import { createFormateurMagicLink } from "@/server/formateur/magic-link";
import { buildFormateurMagicLinkUrl } from "@/server/formateur/routes";
import { clearFormateurCookie } from "@/server/formateur/cookie";

export interface FormateurAuthState {
  readonly ok: boolean;
  readonly message: string;
}

/** Message générique renvoyé que l'e-mail existe ou non (anti-énumération). */
const GENERIC_MESSAGE =
  "Si un compte formateur correspond à cette adresse, un lien de connexion vient d'être envoyé. Vérifiez votre boîte (et vos spams).";

const emailSchema = z.string().trim().toLowerCase().email();

export async function sendFormateurMagicLinkAction(
  _prev: FormateurAuthState | undefined,
  formData: FormData,
): Promise<FormateurAuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: "Adresse e-mail invalide." };
  }
  const email = parsed.data;
  const ip = await getClientIp();

  // Rate limit composite IP + e-mail (envoi d'e-mails = coûteux + anti-abus).
  const rlIp = await checkRateLimit(`formateur:magic:ip:${ip}`, { limit: 10, windowSec: 900 });
  const rlEmail = await checkRateLimit(`formateur:magic:email:${email}`, {
    limit: 5,
    windowSec: 900,
  });
  // On renvoie le message générique même si rate-limité (pas d'oracle).
  if (!rlIp.allowed || !rlEmail.allowed) {
    return { ok: true, message: GENERIC_MESSAGE };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { email },
    select: { id: true, prenom: true, nom: true, actif: true },
  });

  if (trainer && trainer.actif) {
    const token = await createFormateurMagicLink(trainer.id, ip);
    await enqueueEmail("formateur-magic-link", email, "fr", {
      magicLink: buildFormateurMagicLinkUrl(token),
      formateurNom: trainer.prenom || trainer.nom || undefined,
      expiresInMin: 15,
    });
  }

  return { ok: true, message: GENERIC_MESSAGE };
}

/** Déconnexion : efface le cookie de session formateur. */
export async function logoutFormateurAction(): Promise<void> {
  await clearFormateurCookie();
}
