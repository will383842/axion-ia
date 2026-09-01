// Newsletter — Server Action (Sprint 15 / M8).
//
// Flow double opt-in :
// 1. User soumet email + consentement → status='pending', confirm_token genere
// 2. Email envoye avec lien /confirmer-newsletter?token=...
// 3. Click lien → status='confirmed', confirmedAt = now()
//
// Conformite RGPD (RFC 8058) + droit français : double opt-in obligatoire,
// unsubscribe_token genere des l'inscription pour faciliter le retrait.

"use server";

import crypto from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { syncNewsletterOptInToCrm, syncNewsletterOptOutToCrm } from "@/server/crm-sync";
import { newsletterSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { notify } from "@/server/notifications";
import { redactEmail } from "@/lib/pii-redaction";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";

export type NewsletterState = { ok: true } | { ok: false; error: string };

/**
 * Première version de consentement NOMMÉE pour la lettre (décision actée
 * 2026-08-13). La lettre n'en persistait aucune : le double opt-in prouvait le
 * geste, mais rien ne disait QUEL texte la personne avait accepté. Cette
 * constante voyage avec la fiche vers le CRM ; la persister côté site suppose
 * une colonne, qui viendra avec le lot « consentements centralisés ».
 */
const NEWSLETTER_CONSENT_VERSION = "newsletter-v1-2026-08-13";

export async function subscribeNewsletterAction(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const ip = await getClientIp();

  // 1. Rate limit (3 souscriptions / 5min / IP — anti-spam strict)
  const rl = await checkRateLimit(`newsletter:${ip}`, { limit: 3, windowSec: 300 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans 5 minutes." };
  }

  // 2. Honeypot — Sprint 15 fix Fork 3 C1-3 : champ "website" canonique
  // (uniformise avec contact/audit/booking/implementation/option48h)
  const leurre = formData.get("website");
  if (leurre) {
    // Succes SILENCIEUX cote visiteur (inchange) — mais trace cote serveur.
    signalerHoneypot("newsletter", leurre);
    return { ok: true };
  }

  // 3. Turnstile — SOFT-FAIL (Will 2026-07-01 : zéro friction). On ne bloque
  // plus si le challenge échoue ; honeypot + rate-limit + double opt-in email
  // (le lien de confirmation exige un vrai destinataire) protègent déjà.
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  await verifyTurnstile(turnstileToken, ip).catch(() => false);

  // 4. Validation Zod
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Email ou consentement invalide." };

  const locale = parseLocale(formData.get("locale"));
  const source = (formData.get("source") as string) || null;

  // 5. Upsert (idempotent : si deja inscrit pending → renvoie token)
  const confirmToken = crypto.randomBytes(32).toString("hex");
  const unsubscribeToken = crypto.randomBytes(32).toString("hex");

  const sub = await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: {
      // Si deja confirme, ne touche pas le status. Sinon reset le token.
      confirmToken,
      confirmSentAt: new Date(),
      locale,
    },
    create: {
      email: parsed.data.email,
      locale,
      status: "pending",
      confirmToken,
      confirmSentAt: new Date(),
      unsubscribeToken,
      source,
      ipAddress: ip,
      ipHash: hashIp(ip),
    },
  });

  // 6. Notifications via hub typé (cf. ADR 0027).
  // Migration achevée le 2026-07-29 : confirm et unsubscribe passaient encore
  // par `sendTelegram()` en direct. Les messages ARRIVAIENT bien — ce n'était
  // donc pas un silence — mais ils court-circuitaient le hub, donc le routage
  // vers le groupe « 🔔 Système », la déduplication et le rate-limit. Les
  // catégories `NEWSLETTER_CONFIRMED` / `NEWSLETTER_UNSUBSCRIBED` existaient
  // depuis l'origine sans aucun émetteur.
  //
  // `redactEmail()` est CONSERVÉ dans le payload : ces deux notifications
  // masquaient déjà l'adresse, et le hub n'a pas à en apprendre plus que
  // l'ancien chemin. Réduire une protection en passant par un refactor serait
  // exactement le genre de régression qu'on ne remarque jamais.
  if (sub.status === "pending") {
    await notify({
      category: "NEWSLETTER_PENDING",
      payload: { email: parsed.data.email, locale },
      dedupKey: sub.id,
    });
  }

  // 7. Enqueue email double opt-in (RFC 8058) — marketing=true pour expéditeur news@
  // (CLAUDE.md §11 doctrine : newsletter via news@axion-ia.com vs noreply@ transac)
  await enqueueEmail(
    "newsletter-confirm-optin",
    parsed.data.email,
    locale,
    {
      confirmToken,
      unsubscribeToken: sub.unsubscribeToken ?? unsubscribeToken,
    },
    { marketing: true },
  );

  return { ok: true };
}

// ============================================================
// confirmNewsletterAction — P0-4 fix (RFC 8058 double opt-in)
// ============================================================
//
// Consomme le confirmToken du lien email reçu par l'utilisateur. Au succès :
// status='confirmed', confirmedAt=now(), confirmToken=null (token à usage
// unique). Idempotent : si déjà confirmé, on retourne ok sans rejouer.

export type ConfirmState =
  | { ok: true; alreadyConfirmed: boolean; email: string; locale: "fr" | "en" }
  | { ok: false; error: "missing_token" | "invalid_token" | "unsubscribed" | "internal" };

export async function confirmNewsletterAction(token: string | null): Promise<ConfirmState> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { ok: false, error: "missing_token" };
  }
  try {
    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
    });
    if (!sub) {
      // Idempotency : peut-être déjà confirmé (token cleared) — on tente
      // par fallback : si l'utilisateur reclique un vieux lien, retour
      // soft-success pour ne pas paniquer (au lieu de 404).
      return { ok: false, error: "invalid_token" };
    }
    if (sub.status === "unsubscribed") {
      return { ok: false, error: "unsubscribed" };
    }
    if (sub.status === "confirmed") {
      return {
        ok: true,
        alreadyConfirmed: true,
        email: sub.email,
        locale: sub.locale === "en" ? "en" : "fr",
      };
    }
    await prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        confirmToken: null,
      },
    });
    // Synchro CRM (lot L2) — émise à la CONFIRMATION, jamais à la demande
    // d'inscription : tant que l'adresse n'est pas confirmée, il n'y a pas de
    // consentement à transmettre (et l'inscription peut être le fait d'un tiers).
    await syncNewsletterOptInToCrm({
      subjectRef: `site:newsletter_subscriber:${sub.id}`,
      person: { email: sub.email },
      consent: {
        version: NEWSLETTER_CONSENT_VERSION,
        at: new Date(),
        textRef: "newsletter-double-optin",
      },
      ...(sub.source ? { payload: { source: sub.source } } : {}),
    });

    // REGISTRE DE PREUVE (lot L4) — la lettre n'en avait AUCUNE : le double
    // opt-in prouvait le geste, mais rien ne disait QUEL texte avait été
    // accepté. C'est désormais consigné, et à la CONFIRMATION seulement.
    await recordConsentEvent({
      email: sub.email,
      formRef: CONSENT_FORM_REFS.newsletter,
      consentVersion: NEWSLETTER_CONSENT_VERSION,
      action: "optin",
    });

    await notify({
      category: "NEWSLETTER_CONFIRMED",
      payload: { email: redactEmail(sub.email), locale: sub.locale },
      dedupKey: `newsletter-confirmed-${sub.id}`,
    });
    return {
      ok: true,
      alreadyConfirmed: false,
      email: sub.email,
      locale: sub.locale === "en" ? "en" : "fr",
    };
  } catch (err) {
    // Sprint 24+ fix audit 2026-05-10 : log la vraie cause au lieu d'un
    // catch silencieux. RGPD double opt-in nécessite un audit trail des
    // confirmations échouées (pas juste des succès). Sans ce log, les
    // confirmations perdues sont invisibles côté ops.
    const cause = err instanceof Error ? err.message : String(err);
    console.error(`[confirmNewsletter] DB error: ${cause}`);
    Sentry.captureException(err);
    return { ok: false, error: "internal" };
  }
}

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
    await recordConsentEvent({
      email: sub.email,
      formRef: CONSENT_FORM_REFS.newsletter,
      consentVersion: NEWSLETTER_CONSENT_VERSION,
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
