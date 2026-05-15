"use server";
// Sprint X.5bis — Parcours B (demande devis qualifiée).
//
// Le visiteur ne réserve pas de slot ; il soumet une demande qualifiée que
// Will reprend en négociation (pipeline `qualifying → negotiating → converted`).
//
// Cf. 04-PLAN-EXECUTION Sprint X.5bis + UX-E2E-VERIFICATION B-P0-1 à B-P0-6.

import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { quoteRequestSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendTelegram } from "@/lib/telegram";
import { redactContactLine } from "@/lib/pii-redaction";
import { encryptPii } from "@/lib/pii-crypto";
import { enqueueEmail } from "@/server/queue/queues";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { REFERRER_CITY_COOKIE_NAME } from "@/lib/pseo-referrer";

export type QuoteRequestState = { ok: true; submissionId: string } | { ok: false; error: string };

export async function submitQuoteRequestAction(
  _prev: QuoteRequestState,
  formData: FormData,
): Promise<QuoteRequestState> {
  const ip = await getClientIp();

  // Rate-limit : 3 demandes / heure / IP (parcours B = négociation, peu fréquent).
  const rl = await checkRateLimit(`quote:${ip}`, { limit: 3, windowSec: 3600 });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de demandes. Réessayez plus tard." };
  }

  // Honeypot anti-bot (champ caché `website`).
  if (formData.get("website")) {
    // Réponse OK silencieuse — on ne révèle pas le honeypot.
    return { ok: true, submissionId: "honeypot" };
  }

  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, error: "Captcha échoué." };
  }

  // Coerce + validate. `z.coerce.boolean()` accepte "on"/"true"/"1" depuis FormData.
  const willingToTravelRaw = formData.get("willingToTravel");
  const consentTermsRaw = formData.get("consentTerms");
  const consentGdprRaw = formData.get("consentGdpr");

  const parsed = quoteRequestSchema.safeParse({
    companyName: formData.get("companyName"),
    companySize: formData.get("companySize"),
    companySector: formData.get("companySector"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    interventionSlug: formData.get("interventionSlug") || undefined,
    contextBusiness: formData.get("contextBusiness"),
    budgetIndicative: formData.get("budgetIndicative") || undefined,
    timingWeeks: formData.get("timingWeeks") || undefined,
    city: formData.get("city"),
    willingToTravel: willingToTravelRaw === "on" || willingToTravelRaw === "true",
    participantsEstimate: formData.get("participantsEstimate") || undefined,
    consentTerms: consentTermsRaw === "on" || consentTermsRaw === "true",
    consentGdpr: consentGdprRaw === "on" || consentGdprRaw === "true",
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, error: firstIssue?.message ?? "Champs invalides." };
  }

  const locale = parseLocale(formData.get("locale"));
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent") ?? null;
  const referer = hdrs.get("referer") ?? null;
  // Sprint X.18 — funnel attribution.
  const c = await cookies();
  const utm = readUtmCookie(c.get(UTM_COOKIE_NAME)?.value);
  const refCity = c.get(REFERRER_CITY_COOKIE_NAME)?.value;
  const funnelData: { utm?: typeof utm; referrerCity?: string } | null = (() => {
    const out: { utm?: typeof utm; referrerCity?: string } = {};
    if (Object.keys(utm).length > 0) out.utm = utm;
    if (refCity && refCity.length > 0 && refCity.length <= 120) out.referrerCity = refCity;
    return Object.keys(out).length > 0 ? out : null;
  })();

  // Persistance Submission. Pipeline V1 :
  //   status='new' à la création, Will fait passer en 'qualifying' depuis admin.
  const submission = await prisma.submission.create({
    data: {
      type: "quote_request",
      status: "new",
      locale,
      companyName: parsed.data.companyName,
      sector: parsed.data.companySector,
      address: parsed.data.city,
      employeesCount: parsed.data.companySize,
      contactName: encryptPii(parsed.data.contactName),
      contactEmail: encryptPii(parsed.data.contactEmail),
      contactPhone: encryptPii(parsed.data.contactPhone),
      // Le payload est rangé dans `details` JSONB pour conserver la requête
      // brute (audit + qualification ultérieure par Will).
      details: {
        interventionSlug: parsed.data.interventionSlug ?? null,
        contextBusiness: parsed.data.contextBusiness,
        budgetIndicative: parsed.data.budgetIndicative ?? null,
        timingWeeks: parsed.data.timingWeeks ?? null,
        willingToTravel: parsed.data.willingToTravel ?? null,
        participantsEstimate: parsed.data.participantsEstimate ?? null,
        // Sprint X.18 — funnel attribution (UTM cookie + pSEO referrerCity).
        sourceReferer: referer,
        ...(funnelData ? { funnel: funnelData as unknown as object } : {}),
      } as object,
      ipAddress: ip,
      userAgent,
      ...(referer ? { referer } : {}),
    },
  });

  // Telegram Will — sans PII (redactContactLine masque email/nom).
  await sendTelegram({
    tag: "QUOTE_REQUEST_RECEIVED",
    body: `📋 Demande de devis qualifiée\n• Société : ${parsed.data.companyName} (${parsed.data.companySize} · ${parsed.data.companySector})\n• Contact : ${redactContactLine(parsed.data.contactName, parsed.data.contactEmail)}\n• Format : ${parsed.data.interventionSlug ?? "non précisé"}\n• Ville : ${parsed.data.city}\n• Locale : ${locale}\n• ID : \`${submission.id}\``,
  }).catch(() => {
    /* fail-soft Telegram : ne bloque pas la submission */
  });

  // Email visiteur : confirmation de réception + ETA 24-48h (négo libre).
  await enqueueEmail("quote-request-received", parsed.data.contactEmail, locale, {
    contactName: parsed.data.contactName,
    companyName: parsed.data.companyName,
    submissionId: submission.id,
  }).catch(() => {
    /* fail-soft email queue (BullMQ Redis down → email manquant mais submission OK) */
  });

  return { ok: true, submissionId: submission.id };
}
