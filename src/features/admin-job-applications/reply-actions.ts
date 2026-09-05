// Répondre à un candidat DEPUIS LA CONSOLE — Server Actions.
//
// Calque de `admin-submissions/reply-actions.ts`, avec deux écarts assumés,
// tous deux documentés à leur point d'application :
//   1. la garde de rôle (voir `requireEcritureCandidature`) ;
//   2. l'écriture au journal DANS la transaction (voir `repondreAuCandidatAction`).

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { enqueueEmail } from "@/server/queue/queues";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";

import { ecrireEtEnfilerReponse } from "./envoyer-reponse";
import { MODELES_REPONSE_IDS } from "@/content/recrutement/modeles-reponse";

/**
 * Qui peut écrire à un candidat.
 *
 * 🔴 ÉCART DÉLIBÉRÉ avec `requireAdminWriteSession` des messages, qui autorise
 * `super_admin | admin | editor`.
 *
 * Répondre à une candidature expose nécessairement l'identité du candidat :
 * l'action lit son adresse, la déchiffre, et la met dans un e-mail. Or `editor`
 * n'a PAS le droit d'ouvrir un dossier de candidat (`ROLES_DOSSIER_CANDIDAT`).
 * Reprendre la garde des messages ici aurait recréé, sur une surface neuve,
 * exactement le défaut `T5` de l'audit : un rôle qui écrit sur un dossier qu'il
 * ne peut pas lire.
 *
 * On applique donc le prédicat de LECTURE du dossier, qui est le bon périmètre
 * — quiconque peut écrire doit pouvoir lire. L'alignement du reste des actions
 * de candidature (mise à jour de statut, notes) relève du lot 6 ; ce n'est pas
 * une raison pour construire le défaut en avant.
 */
async function requireEcritureCandidature(): Promise<{
  userId: string;
  nom: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, nom };
}

const schemaReponse = z.object({
  applicationId: z.string().uuid(),
  /**
   * Objet du message.
   *
   * Le référentiel e-mail borne l'objet à 45 caractères VISIBLES (`OBJET_MAX`) —
   * au-delà, les clients de messagerie coupent. Ce n'est pas imposé ici : c'est
   * un objet écrit par un humain pour un autre, et refuser une soumission à 47
   * caractères serait une contrainte de forme là où le composeur peut se
   * contenter d'avertir. La borne à 120 protège la colonne, pas le style.
   */
  subject: z.string().min(2).max(120),
  bodyMarkdown: z.string().min(1).max(50_000),
  modele: z.enum(MODELES_REPONSE_IDS).default("libre"),
  internalNote: z.string().max(2000).optional(),
});

export type EtatReponse =
  | { ok: true; replyId: string }
  /** `replyId` présent si la réponse est en base mais que l'envoi a échoué :
   *  elle est alors rejouable, et l'écran doit le proposer. */
  | { ok: false; error: string; replyId?: string };

export async function repondreAuCandidatAction(
  input: z.input<typeof schemaReponse>,
): Promise<EtatReponse> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureCandidature();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const parsed = schemaReponse.safeParse(input);
  if (!parsed.success) return { ok: false, error: "champs_invalides" };
  const data = parsed.data;

  const candidature = await prisma.jobApplication.findUnique({
    where: { id: data.applicationId },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      offerTitleSnap: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!candidature) return { ok: false, error: "candidature_introuvable" };

  // 🔑 L'ÉCRITURE PASSE PAR `ecrireEtEnfilerReponse`, ET C'EST LE MÊME CHEMIN
  // QUE L'ENVOI GROUPÉ. Ces cent lignes vivaient ici ; les recopier dans le
  // geste groupé les aurait fait dériver, et ce qui se perd dans une copie, ce
  // sont exactement les gestes qui ne se voient pas à l'écran : la transaction
  // qui tient ensemble la réponse et sa trace, le `new` qui passe à
  // `reviewing`, et le `failed` posé quand la file d'envoi refuse.
  const issue = await ecrireEtEnfilerReponse(candidature, acteur, {
    subject: data.subject,
    bodyMarkdown: data.bodyMarkdown,
    modele: data.modele,
    internalNote: data.internalNote,
  });

  if (!issue.ecrit) return { ok: false, error: issue.error };

  revalidatePath(adminPath("fr", "contacts/candidatures"));
  revalidatePath(adminPath("fr", `contacts/candidatures/${candidature.id}`));
  updateTag(INBOX_COUNTS_TAG);

  // 🔴 La réponse EXISTE, marquée `failed`. On rend son identifiant pour que
  // l'écran propose de la rejouer — un échec de file n'est pas un message perdu.
  if (!issue.enfile) return { ok: false, error: issue.error, replyId: issue.replyId };

  return { ok: true, replyId: issue.replyId };
}

/** Remet en file une réponse dont l'envoi a échoué. */
export async function rejouerReponseEchoueeAction(replyId: string): Promise<EtatReponse> {
  try {
    await requireEcritureCandidature();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const reponse = await prisma.jobApplicationReply.findUnique({
    where: { id: replyId },
    select: { id: true, applicationId: true, subject: true, deliveryStatus: true },
  });
  if (!reponse) return { ok: false, error: "candidature_introuvable" };
  if (reponse.deliveryStatus === "sent") return { ok: false, error: "deja_envoyee" };

  const candidature = await prisma.jobApplication.findUnique({
    where: { id: reponse.applicationId },
    select: { locale: true },
  });
  if (!candidature) return { ok: false, error: "candidature_introuvable" };

  let misEnFile = false;
  try {
    const r = await enqueueEmail("candidature-reponse", "", candidature.locale, {
      replyId: reponse.id,
      subject: reponse.subject,
      applicationId: reponse.applicationId,
    });
    misEnFile = r.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }
  if (!misEnFile) return { ok: false, error: "enqueue_failed", replyId: reponse.id };

  await prisma.jobApplicationReply.update({
    where: { id: reponse.id },
    data: { deliveryStatus: "pending", errorMsg: null },
  });
  revalidatePath(adminPath("fr", `contacts/candidatures/${reponse.applicationId}`));
  return { ok: true, replyId: reponse.id };
}

/** État de livraison d'une réponse — sondé par le composeur après l'envoi. */
export async function etatLivraisonReponseAction(
  replyId: string,
): Promise<{ statut: string; erreur: string | null } | null> {
  try {
    await requireEcritureCandidature();
  } catch {
    return null;
  }
  const r = await prisma.jobApplicationReply.findUnique({
    where: { id: replyId },
    select: { deliveryStatus: true, errorMsg: true },
  });
  return r ? { statut: r.deliveryStatus, erreur: r.errorMsg } : null;
}
