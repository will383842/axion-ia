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
 * `CRM_SYNC_GUIDE_ENABLED` : le CRM l'inscrit dans sa liste de suppression et
 * le sort de toute diffusion future. Seulement sur la TRANSITION (un rebond de
 * plus sur une adresse déjà `bounced` ne réémet rien).
 *
 * ⚠️ L'événement porte l'ADRESSE en clair (`dispatch` la joint toujours, avec
 * sa clé) — le CRM, lui, n'en garde que l'empreinte. Il ne part donc QUE si la
 * personne a déjà pu entrer au CRM par la lettre ou le guide (une ligne
 * `newsletter_optin` ou `lead_magnet_requested` qui peut l'atteindre,
 * `aPuEntrerAuCrmParLaLettreOuLeGuide`) : sinon le rebond ferait voyager
 * l'adresse de quelqu'un qui n'y a jamais eu de fiche. Adresse exclue
 * (`CRM_SYNC_EXCLUSIONS_SHA256`) : rien.
 *
 * Fail-soft : ne lève jamais. Le webhook qui l'appelle doit répondre 200 quoi
 * qu'il arrive (un 500 répété fait désabonner ZeptoMail).
 */

import { prisma } from "@/lib/prisma";
import { syncEmailHardBouncedToCrm } from "@/server/crm-sync";
import { isCrmSyncGuideEnabled } from "@/server/crm-sync/config";
import { auPlus, erreurSansDonnees } from "@/server/crm-sync/enqueue";
import { eventIdRebondDur } from "@/server/crm-sync/event-id";
import { estExclueDuCrm } from "@/server/crm-sync/exclusions";
import { aPuEntrerAuCrmParLaLettreOuLeGuide } from "@/server/crm-sync/lettre-guide";

/**
 * Attente maximale de la transmission au CRM dans le webhook (lot L4-S) : il
 * doit répondre 200 vite, quoi qu'il arrive. Au-delà, l'écriture finit seule.
 */
const ATTENTE_MAX_CRM_MS = 1_500;

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
      if (r.count > 0) await auPlus(transmettreRebondDur(destinataire, quand), ATTENTE_MAX_CRM_MS);
      return r.count;
    }
    const r = await prisma.newsletterSubscriber.updateMany({
      where: { email: destinataire },
      data: { softBounceCount: { increment: 1 }, lastSoftBounceAt: quand },
    });
    return r.count;
  } catch (e) {
    console.error("[newsletter] rebond non reporté sur l'abonné :", erreurSansDonnees(e));
    return 0;
  }
}

/**
 * `email_hard_bounced` vers le CRM, après la transition vers `bounced`. Aucune
 * lecture tant que le drapeau est fermé. Ne lève jamais : un échec de synchro
 * ne doit pas faire échouer le webhook. La mise en file n'est jamais attendue.
 */
async function transmettreRebondDur(destinataire: string, quand: Date): Promise<void> {
  if (!isCrmSyncGuideEnabled()) return;
  try {
    if (estExclueDuCrm(destinataire)) return;
    const abonne = await prisma.newsletterSubscriber.findUnique({
      where: { email: destinataire },
      select: { id: true, email: true },
    });
    if (abonne === null) return;
    // Jamais transmise au CRM : l'adresse n'y part pas pour un rebond.
    if (!(await aPuEntrerAuCrmParLaLettreOuLeGuide(abonne))) return;
    await syncEmailHardBouncedToCrm({
      eventId: eventIdRebondDur(abonne.id, quand),
      subjectRef: `site:newsletter_subscriber:${abonne.id}`,
      occurredAt: quand,
      person: { email: abonne.email },
      payload: { reason: "hard_bounce" },
    });
  } catch (e) {
    console.error("[newsletter] rebond dur non transmis au CRM :", erreurSansDonnees(e));
  }
}
