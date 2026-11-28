/**
 * Garde du lien de signature AU RENDU (worker). L'e-mail de devis ou de relance dont le lien est
 * refusé par ce serveur d'envoi (adresse du site différente entre site et worker) ne part PAS sans
 * bouton : le journal est clos en échec, la corbeille le dit, l'équipe est alertée, la tâche échoue
 * définitivement (une configuration ne se répare pas par un nouvel essai).
 *
 * ⛔ Jamais d'URL, de jeton, d'adresse ni de nom dans le motif, l'alerte, Sentry ou la console.
 */

import * as Sentry from "@sentry/nextjs";
import { UnrecoverableError } from "bullmq";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";
import { cloturerJournal } from "@/server/email/email-log";
import { idLigneDepuisCleTache } from "@/server/email/outbox-en-cours";
import { EmailLogStatus } from "../../../prisma/generated/client";

export const MOTIF_LIEN_REFUSE_AU_RENDU =
  "Non envoyé : le lien de signature n'est pas reconnu par le serveur d'envoi (adresse du site différente). Corrigez le réglage, puis renvoyez le devis depuis sa fiche.";

const FORME_NUMERO = /^[A-Za-z0-9._-]{1,40}$/;

/** Numéro du devis lu dans la charge, SEULEMENT s'il a la forme d'un numéro. */
export function numeroDevisSur(payload: unknown): string {
  const n =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).numero
      : undefined;
  return typeof n === "string" && FORME_NUMERO.test(n) ? n : "(numéro illisible)";
}

export async function traiterLienSignatureRefuse(a: {
  job: { id?: string | undefined; timestamp?: number | undefined };
  template: string;
  to: string;
  locale: string;
  marketing: boolean;
  attempts: number;
  entityType?: string | undefined;
  entityId?: string | undefined;
  payload: unknown;
}): Promise<never> {
  // 1. Journal clos en échec, dès le premier essai.
  await cloturerJournal({
    template: a.template,
    recipient: a.to,
    locale: a.locale as "fr" | "en",
    marketing: a.marketing,
    attempts: a.attempts,
    status: EmailLogStatus.failed,
    error: MOTIF_LIEN_REFUSE_AU_RENDU,
    failedAt: new Date(),
    ...(a.entityType ? { entityType: a.entityType } : {}),
    ...(a.entityId ? { entityId: a.entityId } : {}),
    ...(a.job.id ? { jobId: a.job.id } : {}),
  });

  // 2. Corbeille, au mieux : LA ligne de cet envoi (id tiré de l'identifiant de tâche
  // `outbox-<id>`) passe « refusé » avec le motif. Envoi direct (pas d'`outbox-`) : aucune
  // écriture, le journal clos et l'alerte suffisent. L'écriture finale du site exige
  // `statut: "approuve"` : elle rendra 0 et ne fera que journaliser un avertissement Sentry
  // (« la ligne n'était plus « approuvé » à l'écriture »), sans plantage.
  const idLigne = idLigneDepuisCleTache(a.job.id);
  if (idLigne !== null) {
    try {
      await prisma.emailOutbox.updateMany({
        where: { id: idLigne, statut: { in: ["approuve", "envoye"] } },
        data: { statut: "refuse", refuseAt: new Date(), refuseMotif: MOTIF_LIEN_REFUSE_AU_RENDU },
      });
    } catch {
      // Au mieux : le journal clos et l'alerte restent.
    }
  }

  // 3. Alerte interne, au numéro du devis seulement.
  const numero = numeroDevisSur(a.payload);
  const relance = a.template === "relance-devis-client";
  const suite = relance
    ? "L'ancien lien du client est révoqué et le lien neuf n'a été remis à personne : le client n'a plus de lien valable."
    : "Premier envoi : le devis est marqué envoyé mais aucun e-mail n'est parti. Renvoi : l'ancien lien du client est révoqué et le lien neuf n'a été remis à personne.";
  const texte = `Devis ${numero} : e-mail ${relance ? "de relance" : "de devis"} NON envoyé, lien de signature refusé par le serveur d'envoi (adresse du site différente entre site et worker). ${suite} Corrigez NEXT_PUBLIC_SITE_URL du worker, redémarrez-le, puis renvoyez le devis depuis sa fiche (ne pas « Réessayer » le job).`;
  try {
    Sentry.captureMessage(texte, {
      level: "error",
      tags: { action: "lienSignatureRefuseAuRendu", template: a.template },
    });
  } catch {
    // Une alerte qui échoue ne change pas l'issue.
  }
  sendTelegram({ tag: "AUTO", body: `🔴 ${texte}` }).catch(() => {});

  // 4. Échec définitif : BullMQ ne réessaie pas.
  throw new UnrecoverableError(MOTIF_LIEN_REFUSE_AU_RENDU);
}
