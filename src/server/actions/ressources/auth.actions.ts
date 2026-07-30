"use server";

/**
 * Espace ressources — auth passwordless (2026-06-13).
 * Envoi de lien magique si l'e-mail correspond à un destinataire actif.
 * Réponse toujours générique (anti-énumération). Rate-limité.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/server/queue/queues";
import { createRessourcesMagicLink } from "@/server/ressources/magic-link";
import { buildRessourcesMagicLinkUrl } from "@/server/ressources/routes";
import { clearRessourcesCookie } from "@/server/ressources/cookie";

export interface RessourcesAuthState {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * Message générique (anti-énumération). Même correctif que l'espace formateur,
 * 2026-07-28 : au-delà de 5 demandes en 15 minutes la limite anti-abus
 * court-circuite l'envoi et renvoie ce message de succès. Sans la seconde
 * phrase, la personne réessaie indéfiniment et prolonge son propre blocage,
 * sans aucun moyen de le comprendre.
 *
 * Phrase affichée DANS TOUS LES CAS : invariante, elle n'apprend rien à qui
 * sonde des adresses, et débloque le destinataire légitime.
 */
const GENERIC_MESSAGE =
  "Si un accès correspond à cette adresse, un lien de connexion vient d'être envoyé. " +
  "Vérifiez votre boîte (et vos spams). Le lien est valable 15 minutes. " +
  "Si vous en avez déjà demandé plusieurs, patientez un quart d'heure avant de réessayer : " +
  "au-delà de cinq demandes rapprochées, les envois suivants sont suspendus.";

const emailSchema = z.string().trim().toLowerCase().email();

export async function sendRessourcesMagicLinkAction(
  _prev: RessourcesAuthState | undefined,
  formData: FormData,
): Promise<RessourcesAuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Adresse e-mail invalide." };
  const email = parsed.data;
  const ip = await getClientIp();

  const rlIp = await checkRateLimit(`ressources:magic:ip:${ip}`, { limit: 10, windowSec: 900 });
  const rlEmail = await checkRateLimit(`ressources:magic:email:${email}`, {
    limit: 5,
    windowSec: 900,
  });
  if (!rlIp.allowed || !rlEmail.allowed) return { ok: true, message: GENERIC_MESSAGE };

  const recipient = await prisma.documentRecipient.findFirst({
    where: { email, actif: true },
    select: { id: true, nom: true },
  });

  if (recipient) {
    const token = await createRessourcesMagicLink(recipient.id, ip);
    await enqueueEmail("ressources-magic-link", email, "fr", {
      magicLink: buildRessourcesMagicLinkUrl(token),
      destinataireNom: recipient.nom || undefined,
      expiresInMin: 15,
    });
  }

  return { ok: true, message: GENERIC_MESSAGE };
}

export async function logoutRessourcesAction(): Promise<void> {
  await clearRessourcesCookie();
}
