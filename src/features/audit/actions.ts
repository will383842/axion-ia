// Audit — Server Actions (Sprint 15 / M8).
//
// 2 forms distincts :
//  - submitAuditAction (5 steps) : la version legacy (src/lib/schemas/forms.ts auditSchema)
//  - submitAuditRequestAction (6 steps) : la version /audit/demande (auditRequestSchema)

"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auditSchema, auditRequestSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";

export type AuditState = { ok: true; submissionId: string } | { ok: false; error: string };

export async function submitAuditAction(
  _prev: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`audit:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  if (formData.get("website")) return { ok: true, submissionId: "" };

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  const parsed = auditSchema.safeParse({
    size: formData.get("size"),
    modality: formData.get("modality"),
    industry: formData.get("industry"),
    goals: formData.get("goals"),
    contact: formData.get("contact"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    companyName: formData.get("companyName") || undefined,
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const locale = parseLocale(formData.get("locale"));

  const submission = await prisma.submission.create({
    data: {
      type: "audit",
      locale,
      // Sprint 15 fix Fork 2 C4-2 : utilise companyName si fourni
      companyName: parsed.data.companyName ?? parsed.data.contact,
      contactName: parsed.data.contact,
      contactEmail: parsed.data.email,
      contactPhone: parsed.data.phone ?? null,
      sector: parsed.data.industry,
      employeesCount: parsed.data.size,
      details: {
        modality: parsed.data.modality,
        goals: parsed.data.goals,
      },
      ipAddress: ip,
      userAgent: (await headers()).get("user-agent") ?? null,
    },
  });

  await sendTelegram({
    tag: "AUDIT",
    body: `Nouveau audit ${parsed.data.size} • ${parsed.data.modality}\n• Secteur : ${parsed.data.industry}\n• Contact : ${parsed.data.contact} (\`${parsed.data.email}\`)\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  });

  await enqueueEmail("audit-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.contact,
    size: parsed.data.size,
    industry: parsed.data.industry,
    submissionId: submission.id,
  });

  return { ok: true, submissionId: submission.id };
}

export async function submitAuditRequestAction(
  _prev: AuditState,
  formData: FormData,
): Promise<AuditState> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`audit-req:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };

  if (formData.get("website")) return { ok: true, submissionId: "" };

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  const tools = formData.getAll("tools").filter((v): v is string => typeof v === "string");
  const parsed = auditRequestSchema.safeParse({
    auditType: formData.get("auditType"),
    size: formData.get("size"),
    industry: formData.get("industry"),
    companyName: formData.get("companyName") || undefined,
    modality: formData.get("modality"),
    city: formData.get("city"),
    country: formData.get("country"),
    scope: formData.get("scope"),
    scopeDetail: formData.get("scopeDetail"),
    maturity: formData.get("maturity"),
    goals: formData.get("goals"),
    tools: tools.length ? tools : undefined,
    toolsOther: formData.get("toolsOther") || undefined,
    contact: formData.get("contact"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || undefined,
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const locale = parseLocale(formData.get("locale"));

  const submission = await prisma.submission.create({
    data: {
      type: "audit",
      locale,
      companyName: parsed.data.companyName ?? parsed.data.contact,
      contactName: parsed.data.contact,
      contactEmail: parsed.data.email,
      contactPhone: parsed.data.phone ?? null,
      contactRole: parsed.data.role ?? null,
      sector: parsed.data.industry,
      employeesCount: parsed.data.size,
      address: `${parsed.data.city}, ${parsed.data.country}`,
      details: {
        auditType: parsed.data.auditType,
        modality: parsed.data.modality,
        scope: parsed.data.scope,
        scopeDetail: parsed.data.scopeDetail,
        maturity: parsed.data.maturity,
        goals: parsed.data.goals,
        tools: parsed.data.tools ?? [],
        toolsOther: parsed.data.toolsOther,
      },
      ipAddress: ip,
      userAgent: (await headers()).get("user-agent") ?? null,
    },
  });

  await sendTelegram({
    tag: "AUDIT",
    body: `Nouvelle demande audit ${parsed.data.auditType} • ${parsed.data.size}\n• Secteur : ${parsed.data.industry}\n• Lieu : ${parsed.data.city}, ${parsed.data.country} (${parsed.data.modality})\n• Maturité : ${parsed.data.maturity}\n• Contact : ${parsed.data.contact} (\`${parsed.data.email}\`)\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  });

  // Sprint 15 fix Fork 2 W1-2 : enqueue avec tools/role pour Telegram + email
  await enqueueEmail("audit-confirmed", parsed.data.email, locale, {
    contactName: parsed.data.contact,
    auditType: parsed.data.auditType,
    size: parsed.data.size,
    industry: parsed.data.industry,
    submissionId: submission.id,
    tools: parsed.data.tools ?? [],
    toolsOther: parsed.data.toolsOther,
    role: parsed.data.role,
  });

  return { ok: true, submissionId: submission.id };
}
