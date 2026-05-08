// Contact — Server Action (Sprint 15 / M8).
//
// Soumission single-step : nom + email + societe? + message + consent.
// → table submissions avec type='contact', notification Telegram [CONTACT].

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import type { Locale } from "../../../prisma/generated/client";

export type ContactState = { ok: true } | { ok: false; error: string };

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

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

  const locale = ((formData.get("locale") as string) || "fr") as Locale;
  const userAgent = (await headers()).get("user-agent") ?? null;

  const submission = await prisma.submission.create({
    data: {
      type: "contact",
      locale,
      companyName: parsed.data.company ?? "—",
      contactName: parsed.data.name,
      contactEmail: parsed.data.email,
      details: { message: parsed.data.message },
      ipAddress: ip,
      userAgent,
    },
  });

  await sendTelegram({
    tag: "CONTACT",
    body: `Nouveau message\n• De : ${parsed.data.name} (\`${parsed.data.email}\`)${parsed.data.company ? `\n• Société : ${parsed.data.company}` : ""}\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  });

  await enqueueEmail("contact-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.name,
    submissionId: submission.id,
  });

  return { ok: true };
}
