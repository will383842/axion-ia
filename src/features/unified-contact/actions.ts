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
import { notify, type NotificationCategory } from "@/server/notifications";
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
    // Form v2 (2026-05-28) — les 5 demandes périphériques sont stockées comme
    // `contact` au niveau DB (enum fermé), distinction fine via
    // `details.unifiedType` (audit trail) + dispatch downstream.
    case "partenariat":
    case "presse":
    case "recrutement":
    case "speaker":
    case "investisseur":
    case "support_client":
    case "autre":
      return SubmissionType.contact;
  }
}

function notifCategoryFor(type: UnifiedContactType): NotificationCategory {
  switch (type) {
    case "audit":
      return "AUDIT_REQUEST_SUBMITTED";
    case "implementation":
      return "IMPLEMENTATION_REQUEST_SUBMITTED";
    case "formation":
    case "un_a_un":
      return "INTERVENTION_REQUEST_SUBMITTED";
    case "devis":
      return "QUOTE_REQUEST_RECEIVED";
    // Form v2 — catégories dédiées pour routage Telegram fin
    case "presse":
      return "PRESS_REQUEST_SUBMITTED";
    case "recrutement":
      return "RECRUITMENT_RECEIVED";
    case "speaker":
      return "SPEAKER_INVITATION_RECEIVED";
    case "investisseur":
      return "INVESTOR_INQUIRY_RECEIVED";
    case "support_client":
      return "CUSTOMER_SUPPORT_REQUEST";
    case "partenariat":
    case "autre":
      return "CONTACT_FORM_SUBMITTED";
  }
}

function emailTemplateFor(type: UnifiedContactType): EmailJobName {
  switch (type) {
    case "audit":
      return "audit-confirmed";
    case "implementation":
      return "implementation-confirmed";
    // Form v2 — fallback sur `contact-confirmed` pour les 5 nouveaux types.
    // Des templates dédiés (press-confirmed / recruitment-confirmed / etc.)
    // peuvent être ajoutés ultérieurement ; pour l'instant la confirmation
    // générique « nous revenons vers vous » suffit. Le routage interne fin
    // se fait côté Telegram (catégories distinctes).
    case "devis":
    case "formation":
    case "un_a_un":
    case "partenariat":
    case "presse":
    case "recrutement":
    case "speaker":
    case "investisseur":
    case "support_client":
    case "autre":
      return "contact-confirmed";
  }
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

    // 7. Telegram notification — via hub typé (cf. ADR 0027).
    // dedupKey = submission.id pour neutraliser un éventuel double-submit
    // qui passerait au niveau DB (improbable car idempotencyKey, mais
    // defense-in-depth).
    const category = notifCategoryFor(data.type);
    const notifPayload = {
      submissionId: submission.id,
      contactName: data.nom,
      contactEmail: data.email,
      ...(data.telephone ? { contactPhone: data.telephone } : {}),
      ...(data.ville ? { ville: data.ville } : {}),
      ...(data.companyName ? { companyName: data.companyName } : {}),
      ...(data.companySize ? { companySize: data.companySize } : {}),
      ...(data.budgetIndicative ? { budgetIndicative: data.budgetIndicative } : {}),
      ...(data.timingWeeks ? { timingWeeks: data.timingWeeks } : {}),
      ...(data.subType ? { subType: data.subType } : {}),
      ...(data.source ? { source: data.source } : {}),
      ...(category === "CONTACT_FORM_SUBMITTED" ? { formType: data.type } : {}),
      ...(category === "QUOTE_REQUEST_RECEIVED" && data.budgetIndicative
        ? { budget: data.budgetIndicative }
        : {}),
      locale,
    };
    await notify({
      category,
      payload: notifPayload,
      dedupKey: submission.id,
    } as Parameters<typeof notify>[0]);

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
