/**
 * ÉCRIRE UNE RÉPONSE À UNE FICHE (Submission) ET LA REMETTRE À LA FILE — le
 * chemin unique (Candidatures unifiées L6b).
 *
 * Extrait de `replyToSubmissionAction` le jour où l'envoi groupé aux futurs
 * apporteurs est arrivé, pour la raison écrite en tête de
 * `admin-job-applications/envoyer-reponse.ts` : une copie dériverait, et pas au
 * hasard — sur les gestes qui ne se voient pas à l'écran :
 *
 *   · la réponse, son lien privé (s'il y en a un) et les compteurs de la fiche
 *     sont écrits DANS LA MÊME transaction ;
 *   · une fiche `new` passe à `in_progress`, les autres statuts ne bougent pas ;
 *   · `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Un retour faux
 *     marque la réponse `failed` (rejouable), jamais « envoyée ».
 *
 * Ce module n'authentifie rien : les appelants sont des Server Actions qui
 * portent la garde de rôle et le schéma. Il n'est pas `"use server"`.
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { renderEmailTemplate } from "@/lib/email/templates";
import { enqueueEmail } from "@/server/queue/queues";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import {
  corpsAvecFichiers,
  creerLienPartage,
  type LienPrepare,
} from "@/server/partages/attacher-a-une-reponse";

/** La fiche, réduite à ce dont l'envoi a besoin. */
export interface FicheDestinataire {
  id: string;
  /** Adresse telle qu'en base (chiffrée au repos). */
  contactEmail: string;
  locale: "fr" | "en";
  status: string;
}

export interface ContenuReponseFiche {
  subject: string;
  bodyMarkdown: string;
  /** `templateUsed` (40 caractères au plus) : `default`, `custom`, `apporteur:<modèle>`… */
  templateUsed: string;
  internalNote?: string;
  /** Fichiers joints : UN lien privé, ajouté à la fin du message. */
  lienFichiers?: LienPrepare;
}

export type IssueEnvoiFiche =
  | { ecrit: true; enfile: true; replyId: string }
  | { ecrit: true; enfile: false; replyId: string }
  | { ecrit: false; error: "invalid_recipient" | "render_failed" | "db_failed" };

export async function ecrireEtEnfilerReponseSubmission(
  submission: FicheDestinataire,
  acteur: { userId: string; name: string },
  contenu: ContenuReponseFiche,
): Promise<IssueEnvoiFiche> {
  if (!isDecryptedEmailUsable(decryptPii(submission.contactEmail))) {
    return { ecrit: false, error: "invalid_recipient" };
  }
  const corps = corpsAvecFichiers(contenu.bodyMarkdown, contenu.lienFichiers);

  // 1. Pré-rendu HTML + texte : le corps est figé ici, jamais re-rendu par le worker.
  let rendered: { subject: string; html: string; text: string };
  try {
    rendered = await renderEmailTemplate("submission-reply", submission.locale, {
      subject: contenu.subject,
      bodyMarkdown: corps,
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ecrit: false, error: "render_failed" };
  }

  // 2. Réponse + lien + compteurs de la fiche, dans la même transaction.
  const replyId = await prisma
    .$transaction(async (tx) => {
      const reply = await tx.submissionReply.create({
        data: {
          submissionId: submission.id,
          repliedByUserId: acteur.userId,
          repliedByName: acteur.name,
          toEmail: submission.contactEmail,
          subject: contenu.subject,
          bodyHtml: rendered.html,
          bodyText: rendered.text,
          deliveryStatus: "pending",
          ...(contenu.internalNote ? { internalNote: contenu.internalNote } : {}),
          templateUsed: contenu.templateUsed.slice(0, 40),
        },
      });

      if (contenu.lienFichiers) {
        await creerLienPartage(tx, {
          lien: contenu.lienFichiers,
          submissionId: submission.id,
          reponseId: reply.id,
          auteur: { userId: acteur.userId, nom: acteur.name },
        });
      }

      await tx.submission.update({
        where: { id: submission.id },
        data: {
          replyCount: { increment: 1 },
          needsAttention: false,
          ...(submission.status === "new" ? { status: "in_progress" as const } : {}),
        },
      });

      return reply.id;
    })
    .catch((e) => {
      Sentry.captureException(e);
      return null;
    });

  if (!replyId) return { ecrit: false, error: "db_failed" };

  // 3. Mise en file (le worker relit et déchiffre l'adresse : aucune donnée
  //    personnelle dans la file). Échec → `failed`, rejouable depuis la fiche.
  let enqueued = false;
  try {
    const res = await enqueueEmail("submission-reply", "", submission.locale, {
      replyId,
      subject: contenu.subject,
      submissionId: submission.id,
    });
    enqueued = res.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }

  if (!enqueued) {
    await prisma.submissionReply
      .update({
        where: { id: replyId },
        data: {
          deliveryStatus: "failed",
          failedAt: new Date(),
          errorMsg: "enqueue_failed (file d'envoi indisponible)",
        },
      })
      .catch((e) => Sentry.captureException(e));
    return { ecrit: true, enfile: false, replyId };
  }
  return { ecrit: true, enfile: true, replyId };
}
