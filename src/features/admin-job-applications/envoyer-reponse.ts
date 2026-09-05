import "server-only";

/**
 * ÉCRIRE UNE RÉPONSE ET LA REMETTRE À LA FILE — le chemin unique.
 *
 * ── Pourquoi ce fichier est né ────────────────────────────────────────────
 * `repondreAuCandidatAction` portait ce chemin en propre. Le jour où l'envoi
 * groupé est arrivé, il y avait deux issues : recopier la centaine de lignes,
 * ou les extraire. Recopier les aurait fait DÉRIVER — et pas au hasard : ce qui
 * se perd dans une copie, ce sont exactement les gestes qui ne se voient pas à
 * l'écran. Ici, trois d'entre eux comptent :
 *
 *   · la réponse et sa ligne de journal sont écrites DANS LA MÊME transaction ;
 *   · un dossier `new` passe à `reviewing`, les autres statuts sont des
 *     décisions et ne bougent pas ;
 *   · `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Marquer « envoyé »
 *     sur un retour faux est le défaut `D5-1-C1` de ce dépôt — une trace qui
 *     affirme un envoi qui n'a pas eu lieu interdit le rattrapage.
 *
 * Une copie qui oublierait le troisième produirait cinquante lignes `pending`
 * qu'aucun écran ne proposerait de rejouer, et le recruteur croirait avoir
 * répondu. Il n'y a donc qu'un chemin, et les deux gestes l'empruntent.
 *
 * ── Ce que ce module ne fait PAS ──────────────────────────────────────────
 * Il n'authentifie rien et ne valide aucune saisie : les deux appelants sont
 * des Server Actions, ce sont elles qui portent la garde de rôle et le schéma.
 * Le mettre ici l'aurait fait tourner cinquante fois pour un seul geste, et
 * aurait laissé croire que ce module est une frontière — il n'en est pas une,
 * il n'est pas exporté par un `"use server"` et n'est atteignable que depuis
 * du code serveur.
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { renderEmailTemplate } from "@/lib/email/templates";
import { enqueueEmail } from "@/server/queue/queues";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import type { ModeleReponseId } from "@/content/recrutement/modeles-reponse";
import type { Locale } from "../../../prisma/generated/client";

import { consignerEvenement } from "./journal";

/** Le dossier, réduit à ce dont l'envoi a besoin. */
export interface CandidatureDestinataire {
  id: string;
  /** Adresse CHIFFRÉE, telle qu'en base. Elle n'est jamais remise en clair. */
  email: string;
  /**
   * 🔑 Le type de la COLONNE, pas `string`. Le gabarit d'e-mail et la file
   * n'acceptent que `fr | en` ; élargir ici aurait déplacé le refus du
   * typecheck vers l'exécution, sur un chemin qui envoie des courriels.
   */
  locale: Locale;
  status: string;
  offerTitleSnap: string | null;
}

export interface ActeurDeLaReponse {
  userId: string;
  nom: string;
}

export interface ContenuDeLaReponse {
  subject: string;
  bodyMarkdown: string;
  modele: ModeleReponseId;
  internalNote?: string | undefined;
}

/**
 * Issue d'un envoi, du point de vue de l'appelant.
 *
 * 🔴 `enfile: false` avec un `replyId` n'est PAS un échec silencieux : la
 * réponse EXISTE en base, marquée `failed`, et la fiche propose de la rejouer.
 * C'est un état distinct de « rien n'a été écrit », et les deux appelants le
 * traitent différemment — le composeur unitaire le montre, l'envoi groupé le
 * compte à part.
 */
export type IssueEnvoi =
  | { ecrit: true; enfile: true; replyId: string }
  | { ecrit: true; enfile: false; replyId: string; error: "enqueue_failed" }
  | { ecrit: false; error: "invalid_recipient" | "render_failed" | "db_failed" };

/**
 * Écrit la réponse, sa trace au journal, et la remet à la file d'envoi.
 *
 * Le pré-vol déchiffre l'adresse DANS le processus web, qui a la clé : une
 * adresse illisible (clé absente → substitut) doit échouer AVANT qu'on crée une
 * réponse orpheline que personne ne pourra envoyer.
 */
export async function ecrireEtEnfilerReponse(
  candidature: CandidatureDestinataire,
  acteur: ActeurDeLaReponse,
  contenu: ContenuDeLaReponse,
): Promise<IssueEnvoi> {
  if (!isDecryptedEmailUsable(decryptPii(candidature.email))) {
    return { ecrit: false, error: "invalid_recipient" };
  }

  let rendu: { subject: string; html: string; text: string };
  try {
    rendu = await renderEmailTemplate("candidature-reponse", candidature.locale, {
      subject: contenu.subject,
      bodyMarkdown: contenu.bodyMarkdown,
      offerTitle: candidature.offerTitleSnap,
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ecrit: false, error: "render_failed" };
  }

  // 🔑 LA RÉPONSE ET SA TRACE SONT ÉCRITES DANS LA MÊME TRANSACTION.
  // Si le journal était écrit après coup, un échec entre les deux laisserait une
  // réponse partie sans trace. `consignerEvenement` accepte le client de
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
          subject: contenu.subject,
          bodyHtml: rendu.html,
          bodyText: rendu.text,
          deliveryStatus: "pending",
          modeleUtilise: contenu.modele,
          ...(contenu.internalNote ? { internalNote: contenu.internalNote } : {}),
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
          summary: `Réponse envoyée — ${contenu.subject}`,
          body: contenu.bodyMarkdown,
          replyId: reponse.id,
          meta: { modele: contenu.modele },
        },
        tx,
      );

      return reponse.id;
    })
    .catch((e: unknown) => {
      Sentry.captureException(e);
      return null;
    });

  if (!replyId) return { ecrit: false, error: "db_failed" };

  // Le worker relit l'adresse depuis la base et la déchiffre au moment de
  // l'envoi : AUCUNE donnée personnelle ne transite par la file.
  let misEnFile = false;
  try {
    const r = await enqueueEmail("candidature-reponse", "", candidature.locale, {
      replyId,
      subject: contenu.subject,
      applicationId: candidature.id,
    });
    misEnFile = r.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }

  if (!misEnFile) {
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
    return { ecrit: true, enfile: false, replyId, error: "enqueue_failed" };
  }

  return { ecrit: true, enfile: true, replyId };
}
