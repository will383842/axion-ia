// Newsletter — Server Action (Sprint 15 / M8).
//
// Flow double opt-in :
// 1. User soumet email + consentement → status='pending', confirm_token genere
// 2. Email envoye avec lien /confirmer-newsletter?token=...
// 3. Click lien → status='confirmed', confirmedAt = now()
//
// Conformite RGPD (RFC 8058) + droit estonien : double opt-in obligatoire,
// unsubscribe_token genere des l'inscription pour faciliter le retrait.

"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { newsletterSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";

export type NewsletterState = { ok: true } | { ok: false; error: string };

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

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
    },
  });

  // 6. Notifications (fail-soft)
  if (sub.status === "pending") {
    await sendTelegram({
      tag: "NEWSLETTER",
      body: `Nouvelle inscription pending\n• Email : \`${parsed.data.email}\`\n• Locale : ${locale}${source ? `\n• Source : ${source}` : ""}`,
      silent: true,
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
