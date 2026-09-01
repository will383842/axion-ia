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
import { syncFormSubmissionToCrm } from "@/server/crm-sync";
import { CONSENT_FORM_REFS, recordConsentEvent } from "@/lib/consents";
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
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";

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
    // `quote-request-received` était écrit et déclaré depuis le sprint Booking,
    // mais appelé NULLE PART : les demandes de devis retombaient sur l'accusé
    // générique. Branché le 2026-08-13.
    case "devis":
      return "quote-request-received";
    // Les autres types gardent l'accusé générique. Le routage interne fin se
    // fait côté Telegram (catégories distinctes).
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

// `hashIp` throw si IP_HASH_SALT absent en prod (doctrine RGPD). Ce wrapper
// garantit qu'un souci de config env ne fasse JAMAIS échouer la capture d'un
// lead : en cas d'échec on logge et on stocke `null` (le hash IP est une
// donnée secondaire, la capture du contact prime). Décision Will 2026-07-01.
function safeHashIp(ip: string | null | undefined): string | null {
  try {
    return hashIp(ip);
  } catch (err) {
    console.error("[unified-contact] hashIp a échoué (IP_HASH_SALT ?):", err);
    return null;
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
  const leurre = formData.get("website");
  if (leurre) {
    signalerHoneypot("contact", leurre);
    return { ok: true, submissionId: "" };
  }

  // 3. Cloudflare Turnstile — SOFT-FAIL (décision Will 2026-07-01 : zéro
  // friction client, ne JAMAIS perdre un lead). On vérifie le token pour le
  // monitoring mais on NE BLOQUE PLUS si le challenge échoue (réseau
  // restrictif / extension / DNS filtrant challenges.cloudflare.com). Les
  // couches DURES restent le honeypot (ci-dessus) + le rate-limit (3/10min/IP).
  // Le résultat est journalisé dans `details.turnstilePassed` pour audit.
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  const turnstilePassed = await verifyTurnstile(turnstileToken, ip).catch(() => false);

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
        contactEmailHash: hashEmailForLookup(data.email),
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
          // Turnstile soft-fail : trace si le captcha n'a pas validé (audit abus).
          ...(turnstilePassed ? {} : { turnstilePassed: false }),
          ...(Object.keys(funnel).length > 0 ? { funnel: funnel as unknown as object } : {}),
        } as object,
        ipAddress: ip,
        // hashIp défensif : ne doit JAMAIS faire échouer la capture du lead
        // (throw si IP_HASH_SALT absent). En cas d'échec → null + log.
        ipHash: safeHashIp(ip),
        userAgent,
      },
    });

    // 6bis. Synchro CRM (lot L2) — outbox locale, best-effort, JAMAIS bloquante.
    // Aucun try/catch ici : `syncFormSubmissionToCrm` ne lève pas, et ne fait
    // rien du tout tant que `CRM_SYNC_ENABLED` n'est pas à "true".
    await syncFormSubmissionToCrm({
      subjectRef: `site:submission:${submission.id}`,
      formType: data.type,
      occurredAt: submission.submittedAt,
      person: {
        email: data.email,
        fullName: data.nom,
        phone: data.telephone ?? null,
      },
      company: {
        name: data.companyName ?? null,
        city: data.ville ?? null,
        sizeCategory: data.companySize ?? null,
        sector: data.companySector ?? null,
      },
      consent: {
        version: CONSENT_VERSION,
        at: submission.submittedAt,
        textRef: "unified-contact-form",
      },
      payload: {
        ...(data.subType ? { subType: data.subType } : {}),
        ...(data.source ? { source: data.source } : {}),
        ...(Object.keys(funnel).length > 0 ? { funnel } : {}),
      },
    });

    // 6 bis. REGISTRE DE PREUVE (lot L4) — best-effort, jamais bloquant. La
    // version vivait jusqu'ici dans `details.consentVersion`, un JSON : lisible
    // à l'unité, inexploitable pour répondre « prouvez le consentement de cette
    // personne ». Elle est désormais AUSSI dans un registre indexé par personne.
    await recordConsentEvent({
      email: data.email,
      formRef: CONSENT_FORM_REFS.unifiedContact,
      consentVersion: CONSENT_VERSION,
      action: "optin",
      occurredAt: submission.submittedAt,
      ip,
      userAgent,
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
      // Le contenu du message part dans la notif (demande Will 2026-08-12) —
      // tronqué : Telegram plafonne à 4096 c. et l'écran verrouillé n'en montre
      // que quelques lignes de toute façon.
      ...(data.message ? { message: data.message.slice(0, 500) } : {}),
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
    // 7 & 8 = BEST-EFFORT : la notif Telegram et l'email de confirmation NE
    // DOIVENT PAS faire échouer la soumission (le lead est déjà en base). Un
    // échec (Redis/BullMQ/Telegram down) est loggé mais l'utilisateur voit
    // « Succès ». Décision Will 2026-07-01 (robustesse / zéro perte de lead).
    try {
      await notify({
        category,
        payload: notifPayload,
        dedupKey: submission.id,
      } as Parameters<typeof notify>[0]);
    } catch (notifErr) {
      console.error("[unified-contact] notify best-effort a échoué:", notifErr);
      Sentry.captureException(notifErr, {
        tags: { action: "submitUnifiedContactAction", step: "notify", type: data.type },
      });
    }

    try {
      await enqueueEmail(emailTemplateFor(data.type), data.email, locale, {
        contactName: data.nom,
        submissionId: submission.id,
        // `quote-request-received` s'en sert dans sa phrase d'accroche. Sans
        // lui, le gabarit affichait « votre demande de devis pour undefined ».
        ...(data.companyName ? { companyName: data.companyName } : {}),
        type: data.type,
        subType: data.subType,
        // Champs hérités utilisés par les templates existants (audit-confirmed,
        // implementation-confirmed, contact-confirmed) — non bloquant si absent.
        size: data.companySize,
        industry: data.companySector,
        auditType: data.subType,
      });
    } catch (mailErr) {
      console.error("[unified-contact] enqueueEmail best-effort a échoué:", mailErr);
      Sentry.captureException(mailErr, {
        tags: { action: "submitUnifiedContactAction", step: "email", type: data.type },
      });
    }

    return { ok: true, submissionId: submission.id };
  } catch (err) {
    // Seul un échec de l'écriture DB (capture du lead) arrive ici = vraie erreur.
    // On logge le message RÉEL (visible dans les logs Coolify) pour diagnostic.
    console.error("[unified-contact] échec persistance Submission:", err);
    Sentry.captureException(err, {
      tags: { action: "submitUnifiedContactAction", step: "persist", type: data.type, locale },
    });
    return {
      ok: false,
      error: "Une erreur est survenue. Réessayez ou écrivez à contact@axion-ia.com.",
    };
  }
}
