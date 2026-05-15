// Implementation — Server Action (Sprint 15 / M8).
//
// 4 steps : type / budget / description / contact + consent.
// → table submissions type='implementation', notification Telegram [AUTO].

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { implementationSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii } from "@/lib/pii-crypto";
import { sendTelegram } from "@/lib/telegram";
import { redactContactLine } from "@/lib/pii-redaction";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";

export type ImplementationState = { ok: true; submissionId: string } | { ok: false; error: string };

export async function submitImplementationAction(
  _prev: ImplementationState,
  formData: FormData,
): Promise<ImplementationState> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`impl:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  if (formData.get("website")) return { ok: true, submissionId: "" };

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  const parsed = implementationSchema.safeParse({
    type: formData.get("type"),
    budget: formData.get("budget"),
    description: formData.get("description"),
    contact: formData.get("contact"),
    email: formData.get("email"),
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const locale = parseLocale(formData.get("locale"));

  const submission = await prisma.submission.create({
    data: {
      type: "implementation",
      locale,
      companyName: parsed.data.contact,
      contactName: encryptPii(parsed.data.contact),
      contactEmail: encryptPii(parsed.data.email),
      details: {
        implType: parsed.data.type,
        budget: parsed.data.budget,
        description: parsed.data.description,
      },
      ipAddress: ip,
      userAgent: (await headers()).get("user-agent") ?? null,
    },
  });

  await sendTelegram({
    tag: "AUTO",
    body: `Nouvelle implémentation ${parsed.data.type} • budget ${parsed.data.budget}\n• Contact : ${redactContactLine(parsed.data.contact, parsed.data.email)}\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  });

  await enqueueEmail("implementation-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.contact,
    implType: parsed.data.type,
    budget: parsed.data.budget,
    submissionId: submission.id,
  });

  return { ok: true, submissionId: submission.id };
}
