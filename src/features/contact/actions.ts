// Contact — Server Action (Sprint 15 / M8).
//
// Soumission single-step : nom + email + societe? + message + consent.
// → table submissions avec type='contact', notification Telegram [CONTACT].

"use server";

import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { redactContactLine } from "@/lib/pii-redaction";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";

export type ContactState = { ok: true } | { ok: false; error: string };

export async function submitContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const ip = await getClientIp();

  const rl = await checkRateLimit(`contact:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  // Honeypot
  if (formData.get("website")) return { ok: true };

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    message: formData.get("message"),
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const locale = parseLocale(formData.get("locale"));
  const userAgent = (await headers()).get("user-agent") ?? null;
  // Sprint X.18 — funnel attribution (UTM + pSEO referrerCity).
  const c = await cookies();
  const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
  const refCity = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
  const funnel: { utm?: typeof utm; referrerCity?: string } = {};
  if (Object.keys(utm).length > 0) funnel.utm = utm;
  if (refCity && refCity.length > 0 && refCity.length <= 120) funnel.referrerCity = refCity;

  const submission = await prisma.submission.create({
    data: {
      type: "contact",
      locale,
      companyName: parsed.data.company ?? "—",
      contactName: parsed.data.name,
      contactEmail: parsed.data.email,
      details: {
        message: parsed.data.message,
        ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
      } as object,
      ipAddress: ip,
      userAgent,
    },
  });

  await sendTelegram({
    tag: "CONTACT",
    body: `Nouveau message\n• De : ${redactContactLine(parsed.data.name, parsed.data.email)}${parsed.data.company ? `\n• Société : ${parsed.data.company}` : ""}\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  });

  await enqueueEmail("contact-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.name,
    submissionId: submission.id,
  });

  return { ok: true };
}
