/**
 * CONFIRMATION DE LA LETTRE — le geste humain du double opt-in (lot L2).
 *
 * 🔴 La confirmation se faisait au RENDU d'un GET (`/confirmation/newsletter`).
 * Les scanneurs de liens des messageries d'entreprise (Safe Links, Mimecast)
 * ouvrent le lien avant la personne : ils confirmaient à sa place — la preuve
 * du double opt-in ne prouvait plus un geste humain — et la personne arrivait
 * ensuite sur « lien expiré ». La route de désabonnement avait déjà corrigé le
 * même défaut (2026-09-02).
 *
 * Désormais : le GET affiche un bouton, et SEUL le POST de ce bouton
 * (`/api/newsletter/confirmer`) appelle cette fonction. Les anciens liens
 * (`?token=…`) restent valides : ils mènent à la même page, au même bouton.
 *
 * Depuis l'amendement de Will (24/09), plus aucune inscription neuve n'attend
 * de confirmation. Cette fonction sert encore à deux choses :
 *   · les liens de l'ancien double opt-in (`pending`) ;
 *   · la RÉINSCRIPTION d'une personne désabonnée : son opposition n'est jamais
 *     levée par une demande du guide (`guide-ia/lettre.ts`) — seulement ici,
 *     par son clic, sur un jeton que seul l'e-mail « Votre guide » lui a
 *     apporté. C'est à ce moment, et pas avant, que `unsubscribed_at` s'efface.
 *
 * La preuve écrite au registre porte :
 *   · la référence et la version du texte EFFECTIVEMENT accepté (colonnes de
 *     l'inscription ; repli historique pour les inscriptions antérieures) ;
 *   · l'IP (hachée par le registre) et l'agent du POST — le contexte du geste.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"` : exportée d'un tel fichier,
 * elle serait une Server Action appelable par n'importe quel client, qui
 * choisirait lui-même l'IP et l'agent consignés dans la preuve.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncNewsletterOptInToCrm } from "@/server/crm-sync";
import { notify } from "@/server/notifications";
import { redactEmail } from "@/lib/pii-redaction";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";

/** Repli pour les inscriptions antérieures au lot L2 (aucune version portée). */
const VERSION_HISTORIQUE = "newsletter-v1-2026-08-13";

export type ConfirmState =
  | { ok: true; alreadyConfirmed: boolean; locale: "fr" | "en" }
  | { ok: false; error: "missing_token" | "invalid_token" | "unsubscribed" | "internal" };

export interface ContexteConfirmation {
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly maintenant?: Date;
}

export async function confirmerLettre(
  token: string | null,
  contexte: ContexteConfirmation = {},
): Promise<ConfirmState> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { ok: false, error: "missing_token" };
  }
  const maintenant = contexte.maintenant ?? new Date();
  try {
    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
      select: {
        id: true,
        email: true,
        locale: true,
        status: true,
        source: true,
        consentFormRef: true,
        consentVersion: true,
      },
    });
    if (!sub) return { ok: false, error: "invalid_token" };
    const locale = sub.locale === "en" ? "en" : "fr";
    // Rebond dur : l'adresse ne reçoit pas — aucune réinscription possible.
    if (sub.status === "bounced") return { ok: false, error: "unsubscribed" };
    if (sub.status === "confirmed") {
      // 🔑 Le jeton est RETIRÉ ici aussi : il restait valable indéfiniment
      // quand une personne déjà inscrite refaisait la demande.
      await prisma.newsletterSubscriber.update({
        where: { id: sub.id },
        data: { confirmToken: null },
        select: { id: true },
      });
      return { ok: true, alreadyConfirmed: true, locale };
    }

    // Jeton à usage unique : la mise à jour ne passe que s'il est encore là.
    // Deux POST simultanés (double clic) ne produisent qu'UNE confirmation.
    // `pending` (ancien double opt-in) ou `unsubscribed` (réinscription) : le
    // jeton présenté est celui de la ligne, le geste est humain (POST).
    const r = await prisma.newsletterSubscriber.updateMany({
      where: { id: sub.id, confirmToken: token, status: { in: ["pending", "unsubscribed"] } },
      data: {
        status: "confirmed",
        confirmedAt: maintenant,
        confirmToken: null,
        unsubscribedAt: null,
      },
    });
    if (r.count === 0) return { ok: true, alreadyConfirmed: true, locale };

    const formRef = sub.consentFormRef ?? CONSENT_FORM_REFS.newsletter;
    const version = sub.consentVersion ?? VERSION_HISTORIQUE;

    // Synchro CRM — émise à la CONFIRMATION, jamais à la demande : tant que
    // l'adresse n'est pas confirmée, il n'y a pas de consentement à transmettre.
    await syncNewsletterOptInToCrm({
      subjectRef: `site:newsletter_subscriber:${sub.id}`,
      person: { email: sub.email },
      // `textRef` INCHANGÉ pour le CRM (contrat d'ingestion en place, lot L4
      // à venir) ; la version, elle, dit quel texte a été accepté.
      consent: { version, at: maintenant, textRef: CONSENT_FORM_REFS.newsletter },
      ...(sub.source ? { payload: { source: sub.source } } : {}),
    });

    await recordConsentEvent({
      email: sub.email,
      formRef,
      consentVersion: version,
      action: "optin",
      occurredAt: maintenant,
      ip: contexte.ip ?? null,
      userAgent: contexte.userAgent ?? null,
    });

    await notify({
      category: "NEWSLETTER_CONFIRMED",
      payload: { email: redactEmail(sub.email), locale },
      dedupKey: `newsletter-confirmed-${sub.id}`,
    }).catch(() => undefined);

    return { ok: true, alreadyConfirmed: false, locale };
  } catch (err) {
    // Une confirmation perdue doit se voir : le double opt-in exige la trace
    // des échecs, pas seulement des succès.
    console.error(
      `[newsletter] confirmation en échec : ${err instanceof Error ? err.message : String(err)}`,
    );
    Sentry.captureException(err);
    return { ok: false, error: "internal" };
  }
}
