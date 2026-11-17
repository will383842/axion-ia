// ⚠️ PAS de `import "server-only"` ici (2026-09-28). Ce module est atteint par
// la réponse automatique « poste pourvu », qui tourne dans le WORKER BullMQ
// (`tsx`, hors de Next) : `server-only` n'y résout pas, et le cron échouerait
// en silence à chaque passage. Gardé par
// `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.

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
import type { ModeleComposeurId } from "@/content/recrutement/modeles-reponse";
import type { Locale } from "../../../prisma/generated/client";

import { consignerEvenement } from "./journal";
import { lienSuppressionCandidature } from "@/server/careers/lien-suppression-candidature";

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
  /** `null` : réponse automatique (`server/careers/reponse-poste-pourvu.ts`). */
  userId: string | null;
  nom: string;
}

export interface ContenuDeLaReponse {
  subject: string;
  bodyMarkdown: string;
  modele: ModeleComposeurId;
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
  | { ecrit: false; error: "invalid_recipient" | "render_failed" | "db_failed" }
  /** Une réponse identique existe déjà (garde demandée) : rien n'est écrit ni enfilé. */
  | { ecrit: false; error: "doublon"; replyId: string };

/** Fenêtre dans laquelle deux envois identiques sont un seul envoi (double clic). */
export const FENETRE_DOUBLON_REPONSE_MS = 60_000;

/** Options de l'écriture. */
export interface OptionsEcriture {
  /**
   * Refuse d'écrire si une réponse identique (même auteur, même objet, même
   * corps, `pending` à tout âge ou `sent` depuis moins de 60 s) existe déjà. La recherche
   * se fait DANS la transaction, sous verrou consultatif : deux requêtes
   * simultanées se sérialisent, la seconde voit la première.
   */
  garderContreDoublon?: boolean;
}

type ClientTx = Pick<typeof prisma, "$executeRaw" | "jobApplicationReply" | "jobApplicationEvent">;

/** Verrou de transaction, clé dérivée de l'identifiant de la candidature (paramétrée). */
async function verrouillerCandidature(tx: ClientTx, applicationId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`candidature.reponse:${applicationId}`}))`;
}

/** Identifiant d'une réponse identique récente, ou `null`. */
async function trouverDoublon(
  tx: ClientTx,
  candidatureId: string,
  userId: string | null,
  contenu: ContenuDeLaReponse,
): Promise<string | null> {
  const recentes = await tx.jobApplicationReply.findMany({
    where: {
      applicationId: candidatureId,
      repliedByUserId: userId,
      subject: contenu.subject,
      // Une réponse encore `pending` est un doublon quel que soit son âge (elle peut
      // être en essais automatiques depuis plus d'une minute) ; une `sent` ne l'est
      // que dans la fenêtre.
      OR: [
        { deliveryStatus: "pending" },
        {
          deliveryStatus: "sent",
          repliedAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_REPONSE_MS) },
        },
      ],
    },
    select: { id: true },
    orderBy: { repliedAt: "desc" },
    take: 5,
  });
  if (recentes.length === 0) return null;
  // Le corps stocké sur la réponse est le HTML rendu ; le texte écrit par
  // l'auteur est celui du journal, écrit dans la même transaction.
  const evenement = await tx.jobApplicationEvent.findFirst({
    where: {
      applicationId: candidatureId,
      type: "email_envoye",
      body: contenu.bodyMarkdown,
      replyId: { in: recentes.map((r) => r.id) },
    },
    select: { replyId: true },
  });
  return evenement?.replyId ?? null;
}

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
  options: OptionsEcriture = {},
): Promise<IssueEnvoi> {
  if (!isDecryptedEmailUsable(decryptPii(candidature.email))) {
    return { ecrit: false, error: "invalid_recipient" };
  }

  let rendu: { subject: string; html: string; text: string };
  try {
    // Le HTML est rendu ICI et stocké : le lien « Supprimer ma candidature »
    // y est donc figé, avec un jeton qui vit plus longtemps que le dossier.
    const lienSuppression = await lienSuppressionCandidature(candidature.id);
    rendu = await renderEmailTemplate("candidature-reponse", candidature.locale, {
      subject: contenu.subject,
      bodyMarkdown: contenu.bodyMarkdown,
      offerTitle: candidature.offerTitleSnap,
      ...(lienSuppression ? { lienSuppression } : {}),
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ecrit: false, error: "render_failed" };
  }

  // 🔑 LA RÉPONSE ET SA TRACE SONT ÉCRITES DANS LA MÊME TRANSACTION.
  // Si le journal était écrit après coup, un échec entre les deux laisserait une
  // réponse partie sans trace. `consignerEvenement` accepte le client de
  // transaction pour cette raison précise.
  const resultat = await prisma
    .$transaction(async (tx) => {
      // 🔴 Verrou D'ABORD, recherche du doublon ENSUITE, écriture en dernier :
      // hors transaction, deux requêtes simultanées trouvaient zéro réponse et
      // écrivaient toutes les deux. Le verrou se libère au commit.
      if (options.garderContreDoublon) {
        await verrouillerCandidature(tx, candidature.id);
        const doublon = await trouverDoublon(tx, candidature.id, acteur.userId, contenu);
        if (doublon) return { doublon };
      }

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

      return { replyId: reponse.id };
    })
    .catch((e: unknown) => {
      Sentry.captureException(e);
      return null;
    });

  if (!resultat) return { ecrit: false, error: "db_failed" };
  if ("doublon" in resultat) {
    return { ecrit: false, error: "doublon", replyId: resultat.doublon };
  }
  const { replyId } = resultat;

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
