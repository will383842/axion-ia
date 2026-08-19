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

/**
 * Message générique renvoyé que l'e-mail existe ou non (anti-énumération).
 *
 * 🔴 Constat du 2026-07-28, vécu par Will. Au-delà de 5 demandes en 15 minutes,
 * la limite anti-abus court-circuite l'envoi — et renvoie CE MÊME message de
 * succès, délibérément, pour ne pas révéler si l'adresse a un compte. Effet de
 * bord : la personne réessaie, chaque essai lui confirme qu'un lien « vient
 * d'être envoyé », et plus elle insiste plus elle prolonge son propre blocage.
 * Aucun moyen de comprendre, ni pour elle ni pour l'administrateur.
 *
 * La seconde phrase est affichée DANS TOUS LES CAS, y compris quand l'envoi a
 * réussi. C'est ce qui la rend inoffensive : elle n'apprend rien à qui sonde des
 * adresses, puisqu'elle ne varie jamais — et elle donne au formateur réel la
 * seule information qui le débloque.
 */
const GENERIC_MESSAGE =
  "Si un compte formateur correspond à cette adresse, un lien de connexion vient d'être envoyé. " +
  "Vérifiez votre boîte (et vos spams). Le lien est valable 15 minutes. " +
  "Si vous en avez déjà demandé plusieurs, patientez un quart d'heure avant de réessayer : " +
  "au-delà de cinq demandes rapprochées, les envois suivants sont suspendus.";

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
  const rlIp = await checkRateLimit(`formateur:magic:ip:${ip}`, {
    limit: 10,
    windowSec: 900,
    surPanne: "refuser",
  });
  const rlEmail = await checkRateLimit(`formateur:magic:email:${email}`, {
    limit: 5,
    windowSec: 900,
    surPanne: "refuser",
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
