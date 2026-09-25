/**
 * UN REBOND SE LIT AUSSI SUR L'ABONNÉ (lot L3, 2026-09-24).
 *
 * 🔴 Avant ce module, le statut `bounced` (« Rejeté ») de la lettre n'était
 * posé par AUCUN code : le webhook ZeptoMail marquait le rebond sur l'e-mail
 * (`email_logs`), jamais sur l'abonné. Le filtre de la console rendait donc
 * toujours zéro — et demain, un rebond renvoyé par l'outil de lettres
 * (MailWizz) ne correspondra à aucune ligne `email_logs` : sans statut sur
 * l'abonné, il n'aurait nulle part où atterrir.
 *
 *   · rebond DUR  → `status = bounced` : l'adresse est morte. Un abonné
 *     `unsubscribed` le RESTE (son opposition est l'information la plus forte ;
 *     la remplacer par « rejeté » effacerait la trace de son retrait).
 *   · rebond MOU  → compteur (`soft_bounce_count`, `last_soft_bounce_at`), rien
 *     d'autre. Le seuil qui ferait basculer en `bounced` est une décision de
 *     l'outil d'envoi (lot L5, ADR) : le poser ici, sur la seule base des
 *     e-mails transactionnels, compterait une boîte pleine un mardi comme une
 *     adresse morte.
 *
 * Lot L4-S (2026-09-25) — un rebond DUR qui fait passer un abonné en
 * `bounced` est transmis au CRM (`email_hard_bounced`), derrière
 * `CRM_SYNC_GUIDE_ENABLED` : le CRM l'inscrit dans sa liste de suppression
 * (empreinte seule) et le sort de toute diffusion future. Seulement sur la
 * TRANSITION (un rebond de plus sur une adresse déjà `bounced` ne réémet rien).
 *
 * Fail-soft : ne lève jamais. Le webhook qui l'appelle doit répondre 200 quoi
 * qu'il arrive (un 500 répété fait désabonner ZeptoMail).
 */

import { prisma } from "@/lib/prisma";
import { syncEmailHardBouncedToCrm } from "@/server/crm-sync";
import { isCrmSyncGuideEnabled } from "@/server/crm-sync/config";
import { eventIdRebondDur } from "@/server/crm-sync/event-id";

export type TypeRebond = "hard" | "soft";

export async function noterRebondSurAbonne(
  destinataire: string,
  type: TypeRebond,
  quand: Date = new Date(),
): Promise<number> {
  try {
    if (type === "hard") {
      const r = await prisma.newsletterSubscriber.updateMany({
        where: { email: destinataire, status: { in: ["pending", "confirmed"] } },
        data: { status: "bounced" },
      });
      if (r.count > 0) await transmettreRebondDur(destinataire, quand);
      return r.count;
    }
    const r = await prisma.newsletterSubscriber.updateMany({
      where: { email: destinataire },
      data: { softBounceCount: { increment: 1 }, lastSoftBounceAt: quand },
    });
    return r.count;
  } catch (e) {
    console.error(
      "[newsletter] rebond non reporté sur l'abonné :",
      e instanceof Error ? e.message : String(e),
    );
    return 0;
  }
}

/**
 * `email_hard_bounced` vers le CRM, après la transition vers `bounced`. Aucune
 * lecture tant que le drapeau est fermé. Ne lève jamais : un échec de synchro
 * ne doit pas faire échouer le webhook.
 */
async function transmettreRebondDur(destinataire: string, quand: Date): Promise<void> {
  if (!isCrmSyncGuideEnabled()) return;
  try {
    const abonne = await prisma.newsletterSubscriber.findUnique({
      where: { email: destinataire },
      select: { id: true, email: true },
    });
    if (abonne === null) return;
    await syncEmailHardBouncedToCrm({
      eventId: eventIdRebondDur(abonne.id, quand),
      subjectRef: `site:newsletter_subscriber:${abonne.id}`,
      occurredAt: quand,
      person: { email: abonne.email },
      payload: { reason: "hard_bounce" },
    });
  } catch (e) {
    console.error(
      "[newsletter] rebond dur non transmis au CRM :",
      e instanceof Error ? e.message : String(e),
    );
  }
}
