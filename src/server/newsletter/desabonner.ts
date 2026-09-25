/**
 * DÉSABONNEMENT DE LA LETTRE — un seul chemin, quel que soit le déclencheur (lot L3).
 *
 * 🔴 Avant ce module, deux chemins désabonnaient, et ils ne faisaient pas la
 * même chose :
 *   · le lien public (`/api/unsubscribe`, RFC 8058) : statut, opposition au
 *     CRM (`newsletter_optout`), preuve `optout` au registre, Telegram ;
 *   · le bouton « Désabonner » de la console : statut et journal d'activité,
 *     RIEN d'autre. Le CRM n'apprenait jamais la désinscription et le registre
 *     de preuve ne gardait que l'accord, jamais son retrait — constaté en
 *     production (audit du 24/09 : un désabonnement console, zéro `optout`,
 *     zéro `newsletter_optout`).
 *
 * Les deux passent désormais par `desabonnerAbonne`. Ce qui diffère — le motif
 * transmis au CRM, le journal d'activité de l'administrateur — reste chez
 * l'appelant.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"` : exportée d'un tel fichier,
 * la fonction deviendrait une Server Action appelable par n'importe quel
 * client, avec l'identifiant de son choix.
 *
 * ⚠️ JAMAIS appelé par `crm-sync/inbound.ts` : une opposition venue du CRM ne
 * doit pas y repartir (boucle). Le sens entrant écrit sa propre preuve.
 */

import { prisma } from "@/lib/prisma";
import { syncNewsletterOptOutToCrm } from "@/server/crm-sync";
import { notify } from "@/server/notifications";
import { redactEmail } from "@/lib/pii-redaction";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { VERSION_LETTRE_HISTORIQUE } from "./versions";

/** Motif transmis au CRM : il dit PAR OÙ la personne est partie. */
export type MotifDesabonnement = "unsubscribe-link" | "admin-console";

export interface AbonneADesabonner {
  readonly id: string;
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly consentFormRef: string | null;
  readonly consentVersion: string | null;
}

export async function desabonnerAbonne(
  abonne: AbonneADesabonner,
  motif: MotifDesabonnement,
  maintenant: Date = new Date(),
): Promise<void> {
  await prisma.newsletterSubscriber.update({
    where: { id: abonne.id },
    data: {
      status: "unsubscribed",
      unsubscribedAt: maintenant,
      // 🔴 Lot L2 : un jeton de confirmation resté sur la ligne vaudrait
      // réinscription (`confirmerLettre` accepte un désabonné qui présente
      // SON jeton). Seul un jeton posé APRÈS le désabonnement — l'offre de
      // réinscription de l'e-mail « Votre guide » — doit pouvoir le faire.
      confirmToken: null,
    },
  });

  // L'opposition doit valoir PARTOUT : le CRM inscrit l'adresse (hachée) en
  // liste d'opposition, ce qui empêche aussi toute réinsertion par un import.
  await syncNewsletterOptOutToCrm({
    subjectRef: `site:newsletter_subscriber:${abonne.id}`,
    person: { email: abonne.email },
    payload: { reason: motif },
  });

  // Le RETRAIT est une preuve au même titre que l'accord : il s'AJOUTE au
  // registre, sous la MÊME référence que l'accord qu'il retire. Aucune IP ni
  // aucun agent : sur le chemin console, ce seraient ceux de l'administrateur,
  // pas ceux de la personne.
  await recordConsentEvent({
    email: abonne.email,
    formRef: abonne.consentFormRef ?? CONSENT_FORM_REFS.newsletter,
    consentVersion: abonne.consentVersion ?? VERSION_LETTRE_HISTORIQUE,
    action: "optout",
    occurredAt: maintenant,
  });

  await notify({
    category: "NEWSLETTER_UNSUBSCRIBED",
    payload: { email: redactEmail(abonne.email), locale: abonne.locale },
    dedupKey: `newsletter-unsub-${abonne.id}`,
  }).catch(() => undefined);
}
