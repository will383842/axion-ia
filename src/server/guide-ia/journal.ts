/**
 * Le worker d'e-mails CLÔT une demande du guide après l'envoi réel (lot L2).
 *
 * `sent_at` (premier envoi) et `send_count` ne sont posés qu'ICI, une fois le
 * relais SMTP d'accord : une mise en file n'est pas un envoi. C'est ce qui
 * permet au rattrapage de distinguer « parti » de « posé en file puis perdu ».
 *
 * ⚠️ Chargé par le WORKER d'e-mails : seul import autorisé, la base. Tirer le
 * hub de notifications ou `suppression.ts` ici ferait mourir tous les e-mails
 * du site au premier départ (cf. `email-worker.opposition.graphe-worker.spec.ts`).
 *
 * Fail-soft : ne lève jamais. Une écriture ratée ici ne doit pas faire rejouer
 * le job — l'e-mail est DÉJÀ parti, le rejouer l'enverrait deux fois.
 */

import { prisma } from "@/lib/prisma";

export async function marquerGuideEnvoye(
  demandeId: string,
  quand: Date = new Date(),
): Promise<void> {
  try {
    await prisma.guideRequest.update({
      where: { id: demandeId },
      data: { sendCount: { increment: 1 } },
      select: { id: true },
    });
    // Premier envoi seulement : `sent_at` ne bouge plus ensuite.
    await prisma.guideRequest.updateMany({
      where: { id: demandeId, sentAt: null },
      data: { sentAt: quand },
    });
  } catch (e) {
    console.error(
      `[guide-ia] demande ${demandeId} : envoi réussi mais non consigné —`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
