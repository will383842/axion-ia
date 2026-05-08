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
import { sendTelegram } from "@/lib/telegram";
import type { Locale } from "../../../prisma/generated/client";

export type ImplementationState = { ok: true; submissionId: string } | { ok: false; error: string };

async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

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

  const locale = ((formData.get("locale") as string) || "fr") as Locale;

  const submission = await prisma.submission.create({
    data: {
      type: "implementation",
      locale,
      companyName: parsed.data.contact,
      contactName: parsed.data.contact,
      contactEmail: parsed.data.email,
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
    body: `Nouvelle implémentation ${parsed.data.type} • budget ${parsed.data.budget}\n• Contact : ${parsed.data.contact} (\`${parsed.data.email}\`)\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  });

  return { ok: true, submissionId: submission.id };
}
