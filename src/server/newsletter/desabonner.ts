/**
 * DÉSABONNEMENT DE LA LETTRE — un seul chemin, quel que soit le déclencheur (lot L3).
 *
 * 🔴 Avant ce module, deux chemins désabonnaient, et ils ne faisaient pas la
 * même chose :
 *   · le lien public (`/api/unsubscribe`, RFC 8058) : statut, opposition au
 *     CRM (`newsletter_optout`), preuve `optout` au registre, Telegram ;
 *   · le bouton « Désabonner » de la console : il ne changeait que le statut.
 *     Ni le registre de preuve ni le CRM n'apprenaient la désinscription.
 *
 * Les deux passent désormais par `desabonnerAbonne`. Ce qui diffère — le motif
 * transmis au CRM, le journal d'activité de l'administrateur — reste chez
 * l'appelant.
 *
 * ── Une seule transition, même sous la course ───────────────────────────────
 * Deux clics sur le bouton, ou un clic console pendant que la personne suit le
 * lien public : UN désabonnement. Le statut passe par un `updateMany`
 * CONDITIONNEL (`status ≠ unsubscribed`) ; seul l'appel qui a réellement fait
 * la transition (`count === 1`) émet `newsletter_optout` et écrit l'`optout`.
 * L'autre rend `false` et n'écrit rien.
 *
 * Le statut et la ligne d'outbox du CRM sont écrits dans la MÊME transaction
 * (`tx` transmis à `enqueueCrmSyncEvent`) : un désabonnement ne peut plus
 * exister sans son `newsletter_optout`. Si la transaction échoue (une outbox
 * en erreur rend la transaction Postgres inutilisable), le chemin d'avant est
 * rejoué hors transaction, bruyamment : la personne doit être désabonnée, que
 * le CRM suive ou non — le rapprochement rattrape l'événement manquant.
 *
 * La preuve `optout` reste hors transaction : `recordConsentEvent` ne lève
 * jamais (registre best-effort, `lib/consents`) et écrit par son propre
 * client. Son booléen est LU : une preuve non écrite se signale (journal +
 * Telegram, adresse masquée), elle ne se tait pas.
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

/**
 * Désabonne. Rend `true` si CET appel a fait la transition, `false` si la
 * personne était déjà désabonnée (un autre clic, le lien public) — auquel cas
 * rien n'est émis ni écrit.
 */
export async function desabonnerAbonne(
  abonne: AbonneADesabonner,
  motif: MotifDesabonnement,
  maintenant: Date = new Date(),
): Promise<boolean> {
  const transition = {
    where: { id: abonne.id, status: { not: "unsubscribed" as const } },
    data: {
      status: "unsubscribed" as const,
      unsubscribedAt: maintenant,
      // 🔴 Lot L2 : un jeton de confirmation resté sur la ligne vaudrait
      // réinscription (`confirmerLettre` accepte un désabonné qui présente
      // SON jeton). Seul un jeton posé APRÈS le désabonnement — l'offre de
      // réinscription de l'e-mail « Votre guide » — doit pouvoir le faire.
      confirmToken: null,
    },
  };
  // L'opposition doit valoir PARTOUT : le CRM inscrit l'adresse (hachée) en
  // liste d'opposition, ce qui empêche aussi toute réinsertion par un import.
  const optout = {
    subjectRef: `site:newsletter_subscriber:${abonne.id}`,
    person: { email: abonne.email },
    payload: { reason: motif },
  };

  let fait: boolean;
  try {
    fait = await prisma.$transaction(async (tx) => {
      const r = await tx.newsletterSubscriber.updateMany(transition);
      if (r.count !== 1) return false;
      await syncNewsletterOptOutToCrm({ ...optout, tx });
      return true;
    });
  } catch (e) {
    console.error(
      "[newsletter] désabonnement : transaction statut + outbox CRM en échec, repli hors transaction :",
      e instanceof Error ? e.message : String(e),
    );
    const r = await prisma.newsletterSubscriber.updateMany(transition);
    fait = r.count === 1;
    if (fait) await syncNewsletterOptOutToCrm(optout);
  }
  if (!fait) return false;

  // Le RETRAIT est une preuve au même titre que l'accord : il s'AJOUTE au
  // registre, sous la MÊME référence que l'accord qu'il retire. Aucune IP ni
  // aucun agent : sur le chemin console, ce seraient ceux de l'administrateur,
  // pas ceux de la personne.
  const preuve = await recordConsentEvent({
    email: abonne.email,
    formRef: abonne.consentFormRef ?? CONSENT_FORM_REFS.newsletter,
    consentVersion: abonne.consentVersion ?? VERSION_LETTRE_HISTORIQUE,
    action: "optout",
    occurredAt: maintenant,
  });
  if (!preuve) {
    // Le désabonnement est fait ; c'est sa PREUVE qui manque. Le registre
    // raconterait une personne toujours inscrite : à reprendre à la main.
    console.error(
      `[newsletter] désabonnement fait, preuve « optout » NON écrite au registre (abonné ${abonne.id}).`,
    );
    await notify({
      category: "INCIDENT_DETECTED",
      payload: {
        title: "Lettre : désabonnement sans preuve « optout » au registre",
        error: `${redactEmail(abonne.email)} — abonné ${abonne.id}, motif ${motif}`,
      },
      sync: true,
    }).catch(() => undefined);
  }

  await notify({
    category: "NEWSLETTER_UNSUBSCRIBED",
    payload: { email: redactEmail(abonne.email), locale: abonne.locale },
    dedupKey: `newsletter-unsub-${abonne.id}`,
  }).catch(() => undefined);
  return true;
}
