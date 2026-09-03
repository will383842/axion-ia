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
import { renderEmailTemplate } from "@/lib/email/templates";
import { enqueueEmail } from "@/server/queue/queues";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";

import { consignerEvenement } from "./journal";
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

  // Pré-vol : déchiffrer et valider l'adresse DANS le processus web, qui a la
  // clé. Une adresse illisible (clé absente → substitut) doit échouer AVANT
  // qu'on crée une réponse orpheline que personne ne pourra envoyer.
  if (!isDecryptedEmailUsable(decryptPii(candidature.email))) {
    return { ok: false, error: "invalid_recipient" };
  }

  let rendu: { subject: string; html: string; text: string };
  try {
    rendu = await renderEmailTemplate("candidature-reponse", candidature.locale, {
      subject: data.subject,
      bodyMarkdown: data.bodyMarkdown,
      offerTitle: candidature.offerTitleSnap,
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "render_failed" };
  }

  // 🔑 LA RÉPONSE ET SA TRACE SONT ÉCRITES DANS LA MÊME TRANSACTION.
  //
  // C'est l'écart le plus important avec le modèle copié. Si le journal était
  // écrit après coup, un échec entre les deux laisserait une réponse partie
  // sans trace — c'est-à-dire exactement le défaut que ce lot ferme, réintroduit
  // par la porte de service. `consignerEvenement` accepte le client de
  // transaction pour cette raison précise.
  const replyId = await prisma
    .$transaction(async (tx) => {
      const reponse = await tx.jobApplicationReply.create({
        data: {
          applicationId: candidature.id,
          repliedByUserId: acteur.userId,
          repliedByName: acteur.nom,
          // L'adresse CHIFFRÉE est recopiée telle quelle : on ne remet jamais
          // une adresse en clair dans une colonne, même le temps d'un envoi.
          toEmail: candidature.email,
          subject: data.subject,
          bodyHtml: rendu.html,
          bodyText: rendu.text,
          deliveryStatus: "pending",
          modeleUtilise: data.modele,
          ...(data.internalNote ? { internalNote: data.internalNote } : {}),
        },
        select: { id: true },
      });

      await tx.jobApplication.update({
        where: { id: candidature.id },
        data: {
          needsAttention: false,
          // Une candidature à laquelle on vient de répondre n'est plus
          // « nouvelle ». Les autres statuts sont des décisions : on n'y touche
          // pas.
          ...(candidature.status === "new" ? { status: "reviewing" as const } : {}),
        },
      });

      await consignerEvenement(
        {
          applicationId: candidature.id,
          type: "email_envoye",
          authorId: acteur.userId,
          authorName: acteur.nom,
          summary: `Réponse envoyée — ${data.subject}`,
          body: data.bodyMarkdown,
          replyId: reponse.id,
          meta: { modele: data.modele },
        },
        tx,
      );

      return reponse.id;
    })
    .catch((e: unknown) => {
      Sentry.captureException(e);
      return null;
    });

  if (!replyId) return { ok: false, error: "db_failed" };

  // Le worker relit l'adresse depuis la base et la déchiffre au moment de
  // l'envoi : AUCUNE donnée personnelle ne transite par la file.
  let misEnFile = false;
  try {
    const r = await enqueueEmail("candidature-reponse", "", candidature.locale, {
      replyId,
      subject: data.subject,
      applicationId: candidature.id,
    });
    misEnFile = r.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }

  revalidatePath(adminPath("fr", "contacts/candidatures"));
  revalidatePath(adminPath("fr", `contacts/candidatures/${candidature.id}`));
  updateTag(INBOX_COUNTS_TAG);

  if (!misEnFile) {
    // 🔴 `enqueueEmail` ne lève pas : elle rend `{ enqueued }`. Marquer
    // « envoyé » sur un retour faux est le défaut `D5-1-C1` de ce dépôt — une
    // trace qui affirme un envoi qui n'a pas eu lieu interdit le rattrapage.
    await prisma.jobApplicationReply
      .update({
        where: { id: replyId },
        data: {
          deliveryStatus: "failed",
          failedAt: new Date(),
          errorMsg: "enqueue_failed (file d'envoi indisponible)",
        },
      })
      .catch((e: unknown) => Sentry.captureException(e));
    return { ok: false, error: "enqueue_failed", replyId };
  }

  return { ok: true, replyId };
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
