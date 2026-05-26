// Unified contact — Server Action (2026-05-24).
//
// Remplace 6 server actions distinctes (submitContactAction,
// subscribeNewsletterAction, submitAuditAction, submitAuditRequestAction,
// submitImplementationAction, submitQuoteRequestAction) par une seule qui
// dispatche sur `type`.
//
// Pattern hérité de submitContactAction (le plus mature) :
//   - rate-limit Redis 3/10min/IP
//   - honeypot (champ `website`)
//   - Cloudflare Turnstile verify
//   - Zod parse (discriminé par type)
//   - encryptPii sur PII (nom/email/téléphone)
//   - hashIp SHA-256 RGPD
//   - UTM funnel + referrerCity capture
//   - Submission.create (table polymorphe, type = `unified-{...}`)
//   - Telegram tag dispatch
//   - Email transactionnel (audit-confirmed | implementation-confirmed | contact-confirmed)
//   - Sentry captureException
//
// Voir _AUDIT/FORMS-UNIFICATION-2026-05-24/02-DESIGN.md §7.

"use server";

import { headers, cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { SubmissionType } from "../../../prisma/generated/client";
import {
  unifiedContactSchema,
  type UnifiedContactType,
} from "@/lib/schemas/unified-contact-schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { encryptPii } from "@/lib/pii-crypto";
import { hashIp } from "@/lib/security/ip-hash";
import { sendTelegram, type TelegramTag } from "@/lib/telegram";
import { redactContactLine } from "@/lib/pii-redaction";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";

export type UnifiedContactState = { ok: true; submissionId: string } | { ok: false; error: string };

const CONSENT_VERSION = "v1-2026-05-24";

// ---- Dispatch helpers -----------------------------------------------------

/**
 * Mapping vers l'enum Prisma `SubmissionType` (fermé : audit | implementation |
 * intervention | contact | quote_request). Le type métier unifié réel reste
 * accessible via `details.unifiedType`.
 */
function submissionTypeFor(type: UnifiedContactType): SubmissionType {
  switch (type) {
    case "audit":
      return SubmissionType.audit;
    case "implementation":
      return SubmissionType.implementation;
    case "formation":
    case "un_a_un":
      return SubmissionType.intervention;
    case "devis":
      return SubmissionType.quote_request;
    case "partenariat":
    case "autre":
      return SubmissionType.contact;
  }
}

function telegramTagFor(type: UnifiedContactType): TelegramTag {
  switch (type) {
    case "audit":
      return "AUDIT";
    case "formation":
    case "un_a_un":
      return "INTERVENTION";
    case "devis":
    case "implementation":
    case "partenariat":
    case "autre":
      return "CONTACT";
  }
}

function emailTemplateFor(type: UnifiedContactType): EmailJobName {
  switch (type) {
    case "audit":
      return "audit-confirmed";
    case "implementation":
      return "implementation-confirmed";
    case "devis":
    case "formation":
    case "un_a_un":
    case "partenariat":
    case "autre":
      return "contact-confirmed";
  }
}

function humanType(type: UnifiedContactType, locale: "fr" | "en"): string {
  const labels: Record<UnifiedContactType, { fr: string; en: string }> = {
    autre: { fr: "Autre", en: "Other" },
    devis: { fr: "Devis", en: "Quote" },
    audit: { fr: "Audit IA", en: "AI audit" },
    implementation: { fr: "Implémentation IA", en: "AI implementation" },
    formation: { fr: "Formation", en: "Training" },
    un_a_un: { fr: "Coaching 1-à-1", en: "1-on-1 coaching" },
    partenariat: { fr: "Partenariat", en: "Partnership" },
  };
  return labels[type][locale];
}

// ---- Server action --------------------------------------------------------

export async function submitUnifiedContactAction(
  _prev: UnifiedContactState,
  formData: FormData,
): Promise<UnifiedContactState> {
  const ip = await getClientIp();

  // 1. Rate-limit
  const rl = await checkRateLimit(`unified-contact:${ip}`, { limit: 3, windowSec: 600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  }

  // 2. Honeypot — bot silent success
  if (formData.get("website")) {
    return { ok: true, submissionId: "" };
  }

  // 3. Cloudflare Turnstile
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  // 4. Zod parse
  const parsed = unifiedContactSchema.safeParse({
    type: formData.get("type"),
    nom: formData.get("nom"),
    email: formData.get("email"),
    telephone: formData.get("telephone"),
    ville: formData.get("ville"),
    message: formData.get("message"),
    companyName: formData.get("companyName") || undefined,
    companySize: formData.get("companySize") || undefined,
    companySector: formData.get("companySector") || undefined,
    budgetIndicative: formData.get("budgetIndicative") || undefined,
    timingWeeks: formData.get("timingWeeks") || undefined,
    locale: formData.get("locale") || "fr",
    source: formData.get("source") || undefined,
    subType: formData.get("subType") || undefined,
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }
  const data = parsed.data;
  const locale = parseLocale(data.locale);

  // 5. UTM funnel + referrerCity
  const c = await cookies();
  const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
  const refCity = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
  const funnel: { utm?: typeof utm; referrerCity?: string } = {};
  if (Object.keys(utm).length > 0) funnel.utm = utm;
  if (refCity && refCity.length > 0 && refCity.length <= 120) funnel.referrerCity = refCity;

  const userAgent = (await headers()).get("user-agent") ?? null;

  // 6. Persist Submission (table polymorphe)
  try {
    const submission = await prisma.submission.create({
      data: {
        type: submissionTypeFor(data.type),
        locale,
        companyName: data.companyName ?? "—",
        contactName: encryptPii(data.nom),
        contactEmail: encryptPii(data.email),
        contactPhone: encryptPii(data.telephone) ?? null,
        sector: data.companySector ?? null,
        employeesCount: data.companySize ?? null,
        details: {
          unifiedType: data.type,
          subType: data.subType,
          ville: data.ville,
          message: data.message,
          budgetIndicative: data.budgetIndicative,
          timingWeeks: data.timingWeeks,
          source: data.source,
          consentVersion: CONSENT_VERSION,
          ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
        } as object,
        ipAddress: ip,
        ipHash: hashIp(ip),
        userAgent,
      },
    });

    // 7. Telegram notification — tag dispatch
    const typeLabel = humanType(data.type, locale);
    await sendTelegram({
      tag: telegramTagFor(data.type),
      body: [
        `Nouvelle demande **${typeLabel}**`,
        `• De : ${redactContactLine(data.nom, data.email)}`,
        `• Téléphone : ${data.telephone}`,
        `• Ville : ${data.ville}`,
        data.companyName ? `• Société : ${data.companyName}` : null,
        data.companySize ? `• Taille : ${data.companySize}` : null,
        data.budgetIndicative ? `• Budget : ${data.budgetIndicative}` : null,
        data.timingWeeks ? `• Timing : ${data.timingWeeks}` : null,
        data.subType ? `• Sous-type : ${data.subType}` : null,
        `• Source : ${data.source ?? "—"}`,
        `• Locale : ${locale}`,
        `• ID : \`${submission.id}\``,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    // 8. Email confirmation
    await enqueueEmail(emailTemplateFor(data.type), data.email, locale, {
      contactName: data.nom,
      submissionId: submission.id,
      type: data.type,
      subType: data.subType,
      // Champs hérités utilisés par les templates existants (audit-confirmed,
      // implementation-confirmed, contact-confirmed) — non bloquant si absent.
      size: data.companySize,
      industry: data.companySector,
      auditType: data.subType,
    });

    return { ok: true, submissionId: submission.id };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "submitUnifiedContactAction", type: data.type, locale },
    });
    return {
      ok: false,
      error: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
    };
  }
}
