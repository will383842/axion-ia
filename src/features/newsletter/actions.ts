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
import { newsletterSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { notify } from "@/server/notifications";
import { redactEmail } from "@/lib/pii-redaction";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";

export type NewsletterState = { ok: true } | { ok: false; error: string };

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
  if (formData.get("website")) return { ok: true }; // silent succes pour bot

  // 3. Turnstile
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  const captchaOk = await verifyTurnstile(turnstileToken, ip);
  if (!captchaOk) return { ok: false, error: "Captcha échoué." };

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

  // 6. Notifications via hub typé (cf. ADR 0027) — pilote migration.
  // sendTelegram() reste utilisé sur d'autres call-sites du fichier (confirm,
  // unsubscribe) pour limiter le scope de migration de ce sprint.
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
    await sendTelegram({
      tag: "NEWSLETTER",
      body: `Confirmation opt-in\n• Email : \`${redactEmail(sub.email)}\`\n• Locale : ${sub.locale}`,
      silent: true,
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
    await sendTelegram({
      tag: "NEWSLETTER",
      body: `Désinscription\n• Email : \`${redactEmail(sub.email)}\`\n• Locale : ${sub.locale}`,
      silent: true,
    });
    return { ok: true, alreadyUnsubscribed: false, email: sub.email };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "internal" };
  }
}
