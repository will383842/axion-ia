// « Marquer comme envoyée » : le fondateur a retrouvé dans ZeptoMail une réponse écrite à la main
// classée « issue inconnue » ; on la clôt en `sent`, sans jamais la renvoyer.
//
// Partagé par les deux actions serveur (messages, candidatures). N'importe PAS le worker :
// il ne tire que le module pur des états et des clés.
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import {
  PREFIXE_ISSUE_INCONNUE,
  TTL_MARQUEUR_ENVOYE_SEC,
  cleMarqueurEnvoiReponse,
  estIssueInconnue,
  type GabaritReponse,
} from "@/lib/email/reponse-manuelle-etat";

export type ResultatMarquage =
  { ok: true } | { ok: false; error: "not_found" | "pas_issue_inconnue" | "etat_change" };

const MARQUEUR_A_LA_MAIN = "marquee-envoyee-a-la-main";

/** Lève pour annuler la transaction quand la ligne a changé d'état entre la lecture et l'écriture. */
class EtatChange extends Error {}

type LigneLue = {
  id: string;
  deliveryStatus: string;
  failedAt: Date | null;
  errorMsg: string | null;
  parentId: string;
  premiereReponseLe: Date | null;
};

async function lireLigne(gabarit: GabaritReponse, replyId: string): Promise<LigneLue | null> {
  if (gabarit === "submission-reply") {
    const l = await prisma.submissionReply.findUnique({
      where: { id: replyId },
      select: {
        id: true,
        deliveryStatus: true,
        failedAt: true,
        errorMsg: true,
        submissionId: true,
        submission: { select: { firstRepliedAt: true } },
      },
    });
    return l
      ? {
          id: l.id,
          deliveryStatus: l.deliveryStatus,
          failedAt: l.failedAt,
          errorMsg: l.errorMsg,
          parentId: l.submissionId,
          premiereReponseLe: l.submission.firstRepliedAt,
        }
      : null;
  }
  const l = await prisma.jobApplicationReply.findUnique({
    where: { id: replyId },
    select: {
      id: true,
      deliveryStatus: true,
      failedAt: true,
      errorMsg: true,
      applicationId: true,
    },
  });
  return l
    ? {
        id: l.id,
        deliveryStatus: l.deliveryStatus,
        failedAt: l.failedAt,
        errorMsg: l.errorMsg,
        parentId: l.applicationId,
        premiereReponseLe: null,
      }
    : null;
}

export async function marquerReponseEnvoyeeALaMain(args: {
  gabarit: GabaritReponse;
  replyId: string;
  adminUserId: string;
}): Promise<ResultatMarquage> {
  const { gabarit, replyId, adminUserId } = args;

  const ligne = await lireLigne(gabarit, replyId);
  if (!ligne) return { ok: false, error: "not_found" };
  if (ligne.deliveryStatus !== "failed" || !estIssueInconnue(ligne.errorMsg)) {
    return { ok: false, error: "pas_issue_inconnue" };
  }

  // Le marqueur que le worker a posé si le relais avait accepté : on le LIT seulement ici.
  const cle = cleMarqueurEnvoiReponse(gabarit, replyId);
  let marqueur: string | null = null;
  let etatMarqueur: "present" | "absent" | "illisible" = "absent";
  try {
    marqueur = await redis.get(cle);
    etatMarqueur = marqueur ? "present" : "absent";
  } catch {
    marqueur = null;
    etatMarqueur = "illisible";
  }

  const maintenant = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const donnees = {
        deliveryStatus: "sent" as const,
        sentAt: maintenant,
        providerMessageId: marqueur,
        failedAt: null,
        errorMsg: null,
      };
      // Écriture conditionnelle : si un « Réessayer » ou le worker est passé entre-temps, 0 ligne.
      const where = {
        id: replyId,
        deliveryStatus: "failed" as const,
        sentAt: null,
        errorMsg: { startsWith: PREFIXE_ISSUE_INCONNUE },
      };
      const { count } =
        gabarit === "submission-reply"
          ? await tx.submissionReply.updateMany({ where, data: donnees })
          : await tx.jobApplicationReply.updateMany({ where, data: donnees });
      if (count !== 1) throw new EtatChange();

      if (gabarit === "submission-reply") {
        await tx.submission.update({
          where: { id: ligne.parentId },
          data: {
            firstRepliedAt: ligne.premiereReponseLe ?? maintenant,
            lastRepliedAt: maintenant,
          },
        });
      }

      // Trace d'audit : l'id de la réponse (cuid) va dans `changes`, `targetId` est un UUID.
      // Aucune adresse, aucun objet.
      await tx.activityLog.create({
        data: {
          adminUserId,
          action: "reponse.marquee_envoyee_a_la_main",
          targetType: gabarit === "submission-reply" ? "submission" : "job_application",
          targetId: ligne.parentId,
          changes: {
            replyId,
            gabarit,
            marqueurRedis: etatMarqueur,
            issueNotéeLe: ligne.failedAt ? ligne.failedAt.toISOString() : null,
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof EtatChange) return { ok: false, error: "etat_change" };
    throw e;
  }

  // ⛔ SEULEMENT APRÈS la validation : un marqueur posé avant une écriture refusée ferait écrire
  // `sent` au worker sans envoi. `sentAt` suffit de toute façon à arrêter tout job (`dejaParti`).
  try {
    await redis.set(cle, marqueur ?? MARQUEUR_A_LA_MAIN, "EX", TTL_MARQUEUR_ENVOYE_SEC, "NX");
  } catch (e) {
    Sentry.captureException(e);
  }
  return { ok: true };
}
