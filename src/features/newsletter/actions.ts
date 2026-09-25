// Lettre d'information — Server Actions (Sprint 15 / M8, refondu au lot L2).
//
// 🔴 Lot L2 (2026-09-24) — `subscribeNewsletterAction` N'EXISTE PLUS. Le seul
// point d'entrée est le formulaire du guide (`features/guide-ia/actions.ts`) :
// le guide part tout de suite, et la lettre suit la nature de l'adresse
// (amendement de Will du 24/09 : adresse pro → intérêt légitime ; adresse
// perso → case facultative, décochée). Plus de double opt-in pour les
// nouvelles inscriptions.
//
// Ce module garde :
//   · `confirmNewsletterAction` — appelée par le bouton (POST) de la page de
//     confirmation, JAMAIS au rendu d'un GET (les scanneurs de liens des
//     messageries d'entreprise confirmaient à la place de la personne) ;
//   · `unsubscribeNewsletterAction` — RFC 8058.
//
// Droit : le double opt-in n'est PAS une obligation légale en France. Depuis
// l'amendement, la preuve est écrite à la demande (`consent_events`) : le
// texte présenté, sa version, l'horodatage, les empreintes IP et agent.

"use server";

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncNewsletterOptOutToCrm } from "@/server/crm-sync";
import { notify } from "@/server/notifications";
import { redactEmail } from "@/lib/pii-redaction";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";

/**
 * Première version de consentement NOMMÉE pour la lettre (décision actée
 * 2026-08-13). Depuis le lot L2, chaque inscription porte SA référence et SA
 * version (`consentFormRef` / `consentVersion`, textes archivés dans
 * `content/guide-ia-formulaire.ts`) ; cette constante ne sert plus que de
 * REPLI pour les inscriptions antérieures, qui n'en portent pas.
 */
const NEWSLETTER_CONSENT_VERSION = "newsletter-v1-2026-08-13";

// `confirmNewsletterAction` a quitté ce fichier au lot L2 (2026-09-24) :
// elle vit dans `server/newsletter/confirmer.ts`, appelée par la route POST
// `/api/newsletter/confirmer`. Exportée d'un fichier `"use server"`, elle était
// une Server Action appelable par n'importe quel client — et la preuve qu'elle
// écrit (IP et agent hachés) ne peut pas venir d'arguments fournis par lui.

// ============================================================
// unsubscribeNewsletterAction — P0-5 fix (RFC 8058 list-unsubscribe)
// ============================================================
//
// Consomme l'unsubscribeToken du lien email / header List-Unsubscribe-Post.
// Au succès : status='unsubscribed', unsubscribedAt=now(). Token CONSERVÉ
// pour journal d'audit + idempotency. RGPD : on ne supprime pas la ligne
// (preuve de retrait), on flag uniquement.

export type UnsubscribeState =
  | { ok: true; alreadyUnsubscribed: boolean; email: string }
  | { ok: false; error: "missing_token" | "invalid_token" | "internal" };

export async function unsubscribeNewsletterAction(token: string | null): Promise<UnsubscribeState> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { ok: false, error: "missing_token" };
  }
  try {
    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });
    if (!sub) return { ok: false, error: "invalid_token" };
    if (sub.status === "unsubscribed") {
      return { ok: true, alreadyUnsubscribed: true, email: sub.email };
    }
    await prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        status: "unsubscribed",
        unsubscribedAt: new Date(),
        // 🔴 Lot L2 : un jeton de confirmation resté sur la ligne vaudrait
        // réinscription (`confirmerLettre` accepte un désabonné qui présente
        // SON jeton). Seul un jeton posé APRÈS le désabonnement — l'offre de
        // réinscription de l'e-mail « Votre guide » — doit pouvoir le faire.
        confirmToken: null,
      },
    });
    // Synchro CRM (lot L2) — l'opposition doit valoir PARTOUT : le CRM inscrit
    // l'adresse (hashée) en liste d'opposition business, ce qui empêche aussi
    // toute réinsertion par un futur re-scrape.
    await syncNewsletterOptOutToCrm({
      subjectRef: `site:newsletter_subscriber:${sub.id}`,
      person: { email: sub.email },
      payload: { reason: "unsubscribe-link" },
    });

    // Le RETRAIT est une preuve au même titre que l'accord : il s'AJOUTE au
    // registre (`optout`), il n'efface pas la ligne d'opt-in. C'est la
    // succession des deux qui raconte l'histoire complète.
    // Lot L2 : le retrait se range sous la MÊME référence que l'accord qu'il
    // retire — sinon le registre raconterait deux histoires disjointes.
    await recordConsentEvent({
      email: sub.email,
      formRef: sub.consentFormRef ?? CONSENT_FORM_REFS.newsletter,
      consentVersion: sub.consentVersion ?? NEWSLETTER_CONSENT_VERSION,
      action: "optout",
    });

    await notify({
      category: "NEWSLETTER_UNSUBSCRIBED",
      payload: { email: redactEmail(sub.email), locale: sub.locale },
      dedupKey: `newsletter-unsub-${sub.id}`,
    });
    return { ok: true, alreadyUnsubscribed: false, email: sub.email };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "internal" };
  }
}
